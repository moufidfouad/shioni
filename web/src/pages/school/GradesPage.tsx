import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { SchoolOutletContext } from "../../layouts/SchoolLayout";
import { useSchoolParametersQuery } from "../../features/parameters/api";
import { useStudentsQuery } from "../../features/students/api";
import { useSubjectsQuery } from "../../features/subjects/api";
import { useMyTeachingScopeQuery } from "../../features/me/api";
import {
  useBulkSetGradeEvaluationMutation,
  useClassRankingQuery,
  useDeleteEvaluationForClassMutation,
  useGradesQuery,
  useStudentBulletinQuery,
} from "../../features/grades/api";
import PageHeader from "../../components/PageHeader";
import { MentionBadge } from "../../components/StatusBadge";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useEvaluationSelection } from "../../hooks/useEvaluationSelection";
import { useLiveAverages } from "../../hooks/useLiveAverages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageTransition from "@/components/motion/PageTransition";
import { Classe, RankingRow, Serie, Student, TeachingScope } from "../../types";
import { cn } from "@/lib/utils";
import { groupeLabel } from "@/lib/groupeLabel";
import { useSearchParamsState } from "../../hooks/useSearchParamsState";

// Itération 29 — un compte Enseignant restreint (scope `restricted: true`,
// voir useMyTeachingScopeQuery) ne doit se voir proposer QUE ses propres
// classes dans les sélecteurs ; sans scope (ADMIN/GESTION_NOTES, ou
// requête pas encore chargée), aucun filtrage.
function filterGroupesByScope<T extends { id: string }>(groupes: T[], scope?: TeachingScope): T[] {
  if (!scope || !scope.restricted) return groupes;
  const allowed = new Set(scope.groupeIds);
  return groupes.filter((c) => allowed.has(c.id));
}

// Reflète la feuille Excel "NOTES & BULLETINS", avec deux vues distinctes
// (choix documenté, pas de demande explicite) : la saisie brute (une classe
// + une matière + un trimestre + UNE évaluation pondérée à la fois, une
// ligne éditable par élève) et la consultation (classement + bulletin
// détaillé par élève, avec moyenne pondérée par les coefficients, mention,
// et rang — calculés côté serveur, jamais stockés).
//
// Depuis cette itération, une note n'est plus un simple champ fixe : chaque
// évaluation saisie (ex. "Devoir 1", "Composition") porte son propre POIDS,
// qui pèse dans le calcul de la moyenne de la matière (demande explicite de
// l'utilisateur). Voir `grades.service.ts::computeAverage` côté backend
// pour le détail du calcul Σ(valeur×poids)/Σ(poids).
export default function GradesPage() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const parametersQuery = useSchoolParametersQuery(school.id);
  const scopeQuery = useMyTeachingScopeQuery(school.id);
  const groupes = filterGroupesByScope(parametersQuery.data?.groupes ?? [], scopeQuery.data);
  const classes = parametersQuery.data?.classes ?? [];
  const series = parametersQuery.data?.series ?? [];
  const nbTrimestres = parametersQuery.data?.nbTrimestres ?? 3;
  const trimestreOptions = useMemo(() => Array.from({ length: nbTrimestres }, (_, i) => i + 1), [nbTrimestres]);

  const [view, setView] = useState<"saisie" | "bulletins">("saisie");

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Notes & bulletins"
        actions={
          <div className="flex gap-2">
            <Button variant={view === "saisie" ? "default" : "outline"} size="sm" onClick={() => setView("saisie")}>
              Saisie des notes
            </Button>
            <Button variant={view === "bulletins" ? "default" : "outline"} size="sm" onClick={() => setView("bulletins")}>
              Bulletins & classement
            </Button>
          </div>
        }
      />

      {view === "saisie" ? (
        <GradeEntry
          schoolId={school.id}
          groupes={groupes}
          classes={classes}
          series={series}
          scope={scopeQuery.data}
          trimestreOptions={trimestreOptions}
          defaultTrimestre={parametersQuery.data?.trimestreEnCours || 1}
          noteMax={Number(parametersQuery.data?.noteMax ?? 20)}
        />
      ) : (
        <BulletinsView
          schoolId={school.id}
          groupes={groupes}
          classes={classes}
          series={series}
          trimestreOptions={trimestreOptions}
          defaultTrimestre={parametersQuery.data?.trimestreEnCours || 1}
        />
      )}
    </PageTransition>
  );
}

// ----------------------------------------------------------------------------
// Vue "Saisie des notes"
// ----------------------------------------------------------------------------

function GradeEntry({
  schoolId,
  groupes,
  classes,
  series,
  scope,
  trimestreOptions,
  defaultTrimestre,
  noteMax,
}: {
  schoolId: string;
  groupes: { id: string; name: string; classeId: string; serieId?: string | null }[];
  classes: Pick<Classe, "id" | "name">[];
  series: Pick<Serie, "id" | "name">[];
  scope?: TeachingScope;
  trimestreOptions: number[];
  defaultTrimestre: number;
  noteMax: number;
}) {
  // Itération 57 (Étape 4, Vague 4) — filtres synchronisés à l'URL (audit
  // §7 : "toutes [les pages de la Vague 4] avec useSearchParams sur leurs
  // filtres"). `classe`/`trimestre` sont partagés avec BulletinsView
  // ci-dessous (les deux vues ne sont jamais montées en même temps — voir
  // GradesPage — donc pas de collision, et basculer "Saisie" ↔ "Bulletins"
  // conserve la classe/le trimestre déjà choisis, un bonus UX cohérent avec
  // le fait que les deux vues portent sur le même conseil de classe).
  const [groupeId, setGroupeId] = useSearchParamsState("classe");
  const [subjectId, setSubjectId] = useSearchParamsState("matiere");
  const [trimestreParam, setTrimestreParam] = useSearchParamsState("trimestre", String(defaultTrimestre));
  const trimestre = Number(trimestreParam) || defaultTrimestre;
  const setTrimestre = (t: number) => setTrimestreParam(String(t));

  const subjectsQuery = useSubjectsQuery(schoolId);
  // Itération 29 — saisie restreinte à ce que l'enseignant enseigne
  // RÉELLEMENT dans cette classe (couple classe+matière), plus étroit que le
  // simple filtrage par classe utilisé pour les bulletins/classement.
  const subjectsForClass = useMemo(() => {
    const base = (subjectsQuery.data ?? []).filter((s) => s.coefficients.some((c) => c.groupeId === groupeId));
    if (!scope || !scope.restricted) return base;
    const allowed = new Set(scope.assignments.filter((a) => a.groupeId === groupeId).map((a) => a.subjectId));
    return base.filter((s) => allowed.has(s.id));
  }, [subjectsQuery.data, groupeId, scope]);

  // `all: true` — le registre d'UNE classe est par nature borné (jamais la
  // liste complète de l'école) : on veut tout le monde d'un coup, pas une
  // page (voir features/students/api.ts::PageParams).
  const studentsQuery = useStudentsQuery(schoolId, { groupeId: groupeId || undefined }, { all: true });
  const students = useMemo(
    () => (groupeId ? studentsQuery.data?.data ?? [] : []),
    [groupeId, studentsQuery.data]
  );

  const ready = Boolean(groupeId && subjectId && trimestre);
  const gradesQuery = useGradesQuery(schoolId, { groupeId, subjectId, trimestre }, ready);
  const bulkSave = useBulkSetGradeEvaluationMutation(schoolId);
  const deleteEvaluation = useDeleteEvaluationForClassMutation(schoolId);

  // Réinitialise la matière si elle n'est plus proposée pour la classe choisie.
  useEffect(() => {
    if (subjectId && !subjectsForClass.some((s) => s.id === subjectId)) setSubjectId("");
  }, [subjectsForClass, subjectId]);

  // Itération 52 (Étape 3) — sélection d'évaluation (libellés connus,
  // libellé/poids actifs, signal `weightChanged`) extraite dans un hook
  // dédié ; comportement identique à l'inline d'origine, voir
  // useEvaluationSelection.ts pour le détail (3 useEffect préservés tels
  // quels) et la justification de `weightChanged`/`originalWeight`.
  const {
    knownEvaluations,
    selectedLabel,
    setSelectedLabel,
    labelInput,
    setLabelInput,
    weightInput,
    setWeightInput,
    activeLabel,
    activeWeight,
    isExistingEvaluation,
    originalWeight,
    weightChanged,
  } = useEvaluationSelection({
    groupeId,
    subjectId,
    trimestre,
    ready,
    gradesLoading: gradesQuery.isLoading,
    gradesData: gradesQuery.data,
  });

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [pendingDeleteLabel, setPendingDeleteLabel] = useState<string | null>(null);
  // Confirmation avant d'écraser le poids d'une évaluation EXISTANTE
  // (finding "Must" de l'audit : "écraser le poids d'une évaluation
  // existante sans confirmation") — `weightChanged` vient du hook
  // ci-dessus, ce state de confirmation reste local au flux de sauvegarde.
  const [pendingWeightConfirm, setPendingWeightConfirm] = useState(false);

  // Synchronise le brouillon d'édition (une valeur par élève) avec les
  // données déjà enregistrées pour l'évaluation sélectionnée.
  useEffect(() => {
    if (!ready || !selectedLabel) {
      setEdits({});
      return;
    }
    const next: Record<string, string> = {};
    for (const student of students) {
      const grade = gradesQuery.data?.find((g) => g.studentId === student.id);
      const evaluation = grade?.evaluations.find((e) => e.label === selectedLabel);
      next[student.id] = evaluation ? String(evaluation.value) : "";
    }
    setEdits(next);
    // Intentionally depending on `students.length` rather than the `students`
    // array itself: `students` is a new array reference on every render of
    // the parent query, which would re-run this effect (and reset
    // in-progress edits) far more often than the underlying data actually
    // changes.
  }, [selectedLabel, ready, gradesQuery.data, students.length]);

  function updateEdit(studentId: string, value: string) {
    setEdits((prev) => ({ ...prev, [studentId]: value }));
  }

  // Itération 52 (Étape 3) — Map mémoïsée remplaçant l'ancienne fonction
  // `computeLiveAverage` recalculée à chaque rendu pour chaque ligne du
  // DataTable (voir useLiveAverages.ts pour le détail du fix de perf ;
  // fusion des évaluations strictement identique à l'original).
  const liveAverages = useLiveAverages({
    gradesData: gradesQuery.data,
    students,
    activeLabel,
    activeWeight,
    edits,
    isExistingEvaluation,
  });

  async function saveEvaluation() {
    try {
      await bulkSave.mutateAsync({
        groupeId,
        subjectId,
        trimestre,
        label: activeLabel,
        weight: activeWeight,
        entries: students.map((s) => ({
          studentId: s.id,
          value: edits[s.id] !== undefined && edits[s.id] !== "" ? Number(edits[s.id]) : null,
        })),
      });
      toast.success("Évaluation enregistrée.");
      if (selectedLabel === "") setSelectedLabel(activeLabel);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Enregistrement impossible.");
    }
  }

  async function handleSave() {
    if (!activeLabel) {
      toast.error("Choisissez ou créez une évaluation.");
      return;
    }
    if (!activeWeight || activeWeight <= 0) {
      toast.error("Le poids doit être un nombre strictement positif.");
      return;
    }
    // Itération 52 (Étape 3) — écraser le poids d'une évaluation déjà
    // existante modifie la moyenne de TOUTE la classe pour cette évaluation ;
    // on demande confirmation avant d'enregistrer plutôt que d'appliquer
    // silencieusement le nouveau poids (finding "Must" de l'audit).
    if (weightChanged) {
      setPendingWeightConfirm(true);
      return;
    }
    await saveEvaluation();
  }

  async function confirmWeightChangeAndSave() {
    setPendingWeightConfirm(false);
    await saveEvaluation();
  }

  async function confirmDeleteEvaluation() {
    if (!pendingDeleteLabel) return;
    try {
      await deleteEvaluation.mutateAsync({ groupeId, subjectId, trimestre, label: pendingDeleteLabel });
      toast.success("Évaluation supprimée pour toute la classe.");
      if (selectedLabel === pendingDeleteLabel) setSelectedLabel(null);
      setPendingDeleteLabel(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  const columns: DataTableColumn<Student>[] = [
    {
      header: "Élève",
      cell: (s) => (
        <div>
          <p className="font-medium">{s.fullName}</p>
          <p className="text-xs text-muted-foreground">{s.matricule}</p>
        </div>
      ),
    },
    {
      header: activeLabel ? `Valeur — ${activeLabel}` : "Valeur",
      cell: (s) => (
        <Input
          type="number"
          min={0}
          max={noteMax}
          step="0.5"
          className="w-20"
          value={edits[s.id] ?? ""}
          onChange={(e) => updateEdit(s.id, e.target.value)}
        />
      ),
    },
    {
      header: "Autres évaluations",
      cell: (s) => {
        const grade = gradesQuery.data?.find((g) => g.studentId === s.id);
        const others = (grade?.evaluations ?? []).filter((e) => e.label !== selectedLabel);
        if (others.length === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {others.map((e) => (
              <Badge key={e.id} variant="secondary" className="font-normal">
                {e.label} : {e.value} ({Number(e.weight)}%)
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      header: "Moyenne pondérée",
      cell: (s) => {
        const avg = liveAverages.get(s.id) ?? null;
        return avg !== null ? (
          <span className="font-medium">{avg.toFixed(2)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="grade-entry-groupe" className="text-xs text-muted-foreground">Classe</Label>
          <Select value={groupeId} onValueChange={setGroupeId}>
            <SelectTrigger id="grade-entry-groupe" className="w-48">
              <SelectValue placeholder="Choisir une classe…" />
            </SelectTrigger>
            <SelectContent>
              {groupes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {groupeLabel(c, classes, series)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="grade-entry-subject" className="text-xs text-muted-foreground">Matière</Label>
          <Select value={subjectId} onValueChange={setSubjectId} disabled={!groupeId}>
            <SelectTrigger id="grade-entry-subject" className="w-52">
              <SelectValue placeholder={groupeId ? "Choisir une matière…" : "Choisir une classe d'abord"} />
            </SelectTrigger>
            <SelectContent>
              {subjectsForClass.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="grade-entry-trimestre" className="text-xs text-muted-foreground">Trimestre</Label>
          <Select value={String(trimestre)} onValueChange={(v) => setTrimestre(Number(v))}>
            <SelectTrigger id="grade-entry-trimestre" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {trimestreOptions.map((t) => (
                <SelectItem key={t} value={String(t)}>
                  Trimestre {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!groupeId && <p className="text-sm text-muted-foreground">Choisissez une classe pour commencer la saisie.</p>}
      {groupeId && subjectsForClass.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucune matière n'a de coefficient configuré pour cette classe (voir Matières & coefficients).
        </p>
      )}

      {ready && (
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Évaluation pondérée — chaque évaluation pèse dans la moyenne selon son poids
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="grade-entry-evaluation" className="text-xs text-muted-foreground">Évaluation existante</Label>
              <Select value={selectedLabel ?? ""} onValueChange={(v) => setSelectedLabel(v)}>
                <SelectTrigger id="grade-entry-evaluation" className="w-56">
                  <SelectValue placeholder={knownEvaluations.length ? "Choisir…" : "Aucune pour l'instant"} />
                </SelectTrigger>
                <SelectContent>
                  {knownEvaluations.map((e) => (
                    <SelectItem key={e.label} value={e.label}>
                      {e.label} — poids {e.weight}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedLabel("")}>
              + Nouvelle évaluation
            </Button>
            {selectedLabel && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-destructive"
                onClick={() => setPendingDeleteLabel(selectedLabel)}
              >
                Supprimer cette évaluation
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {selectedLabel === "" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Libellé</Label>
                <Input
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="ex : Devoir 1"
                  className="w-48"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Poids (%)</Label>
              <Input
                type="number"
                min={1}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-24"
              />
            </div>
          </div>
        </div>
      )}

      {ready && activeLabel && (
        <>
          <DataTable
            columns={columns}
            data={students}
            rowKey={(s) => s.id}
            loading={studentsQuery.isLoading || gradesQuery.isLoading}
            emptyMessage="Aucun élève dans cette classe."
            pageSize={50}
          />
          {students.length > 0 && (
            <Button onClick={handleSave} disabled={bulkSave.isPending}>
              {bulkSave.isPending ? "Enregistrement…" : "Enregistrer cette évaluation"}
            </Button>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDeleteLabel !== null}
        onOpenChange={(open) => !open && setPendingDeleteLabel(null)}
        title="Supprimer cette évaluation ?"
        description={
          <>
            L'évaluation "{pendingDeleteLabel}" sera retirée pour TOUS les élèves de cette classe, dans cette
            matière et ce trimestre. Cette action est irréversible.
          </>
        }
        confirmLabel="Supprimer"
        onConfirm={confirmDeleteEvaluation}
        loading={deleteEvaluation.isPending}
      />

      {/* Itération 52 (Étape 3) — confirmation "Must" de l'audit : écraser le
          poids d'une évaluation existante recalcule la moyenne de toute la
          classe pour cette évaluation. */}
      <ConfirmDialog
        open={pendingWeightConfirm}
        onOpenChange={setPendingWeightConfirm}
        title="Modifier le poids de cette évaluation ?"
        description={
          <>
            Le poids de "{activeLabel}" passera de {originalWeight}&nbsp;% à {activeWeight}&nbsp;% pour TOUTE la
            classe. Les moyennes déjà calculées avec l'ancien poids seront recalculées en conséquence.
          </>
        }
        confirmLabel="Confirmer"
        variant="default"
        onConfirm={confirmWeightChangeAndSave}
        loading={bulkSave.isPending}
        loadingLabel="Enregistrement…"
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Vue "Bulletins & classement"
// ----------------------------------------------------------------------------

function BulletinsView({
  schoolId,
  groupes,
  classes,
  series,
  trimestreOptions,
  defaultTrimestre,
}: {
  schoolId: string;
  groupes: { id: string; name: string; classeId: string; serieId?: string | null }[];
  classes: Pick<Classe, "id" | "name">[];
  series: Pick<Serie, "id" | "name">[];
  trimestreOptions: number[];
  defaultTrimestre: number;
}) {
  // Itération 57 (Étape 4, Vague 4) — mêmes clés d'URL que GradeEntry
  // ci-dessus (`classe`/`trimestre`), voir son commentaire.
  const [groupeId, setGroupeId] = useSearchParamsState("classe");
  const [trimestreParam, setTrimestreParam] = useSearchParamsState("trimestre", String(defaultTrimestre));
  const trimestre = Number(trimestreParam) || defaultTrimestre;
  const setTrimestre = (t: number) => setTrimestreParam(String(t));
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const rankingQuery = useClassRankingQuery(schoolId, groupeId, trimestre, Boolean(groupeId));
  const bulletinQuery = useStudentBulletinQuery(schoolId, expandedStudentId ?? "", trimestre, Boolean(expandedStudentId));

  useEffect(() => {
    setExpandedStudentId(null);
  }, [groupeId, trimestre]);

  const columns: DataTableColumn<RankingRow>[] = [
    {
      header: "Rang",
      cell: (r) => (r.rank !== null ? <span className="font-medium">{r.rank}</span> : <span className="text-muted-foreground">—</span>),
      className: "w-16",
    },
    {
      header: "Élève",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.student.fullName}</p>
          <p className="text-xs text-muted-foreground">{r.student.matricule}</p>
        </div>
      ),
    },
    {
      header: "Moyenne générale",
      cell: (r) => (r.average !== null ? r.average.toFixed(2) : <span className="text-muted-foreground">Pas encore notée</span>),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="grade-ranking-groupe" className="text-xs text-muted-foreground">Classe</Label>
          <Select value={groupeId} onValueChange={setGroupeId}>
            <SelectTrigger id="grade-ranking-groupe" className="w-48">
              <SelectValue placeholder="Choisir une classe…" />
            </SelectTrigger>
            <SelectContent>
              {groupes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {groupeLabel(c, classes, series)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="grade-ranking-trimestre" className="text-xs text-muted-foreground">Trimestre</Label>
          <Select value={String(trimestre)} onValueChange={(v) => setTrimestre(Number(v))}>
            <SelectTrigger id="grade-ranking-trimestre" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {trimestreOptions.map((t) => (
                <SelectItem key={t} value={String(t)}>
                  Trimestre {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!groupeId ? (
        <p className="text-sm text-muted-foreground">Choisissez une classe pour voir le classement et les bulletins.</p>
      ) : (
        <DataTable
          columns={columns}
          data={rankingQuery.data ?? []}
          rowKey={(r) => r.student.id}
          loading={rankingQuery.isLoading}
          emptyMessage="Aucun élève dans cette classe."
          pageSize={50}
          isRowExpanded={(r) => expandedStudentId === r.student.id}
          rowActions={(r) => (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => setExpandedStudentId(expandedStudentId === r.student.id ? null : r.student.id)}
            >
              {expandedStudentId === r.student.id ? "Fermer" : "Bulletin"}
            </Button>
          )}
          renderExpandedRow={(r) => {
            if (expandedStudentId !== r.student.id) return null;
            if (bulletinQuery.isLoading) return <p className="py-2 text-sm text-muted-foreground">Chargement du bulletin…</p>;
            const bulletin = bulletinQuery.data;
            if (!bulletin) return null;
            return (
              <div className="space-y-3 py-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Moyenne générale : <span className="font-semibold text-foreground">{bulletin.average !== null ? bulletin.average.toFixed(2) : "—"}</span> / {bulletin.noteMax}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Rang : <span className="font-semibold text-foreground">{bulletin.rank ?? "—"}</span> / {bulletin.classSize}
                  </span>
                  {bulletin.mention && <MentionBadge mention={bulletin.mention} />}
                </div>
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Matière</th>
                        <th className="px-3 py-2">Coef.</th>
                        <th className="px-3 py-2">Évaluations (valeur / poids)</th>
                        <th className="px-3 py-2">Moyenne</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulletin.subjects.map((s) => (
                        <tr key={s.subjectId} className={cn("border-t")}>
                          <td className="px-3 py-2">{s.subjectName}</td>
                          <td className="px-3 py-2">{s.coefficient}</td>
                          <td className="px-3 py-2">
                            {s.evaluations.length === 0 ? (
                              <span className="text-muted-foreground">Pas encore notée</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {s.evaluations.map((ev) => (
                                  <Badge key={ev.id} variant="secondary" className="font-normal">
                                    {ev.label} : {ev.value} ({Number(ev.weight)}%)
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium">{s.average !== null ? s.average.toFixed(2) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
