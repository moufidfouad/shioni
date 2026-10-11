import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { SchoolOutletContext } from "../../layouts/SchoolLayout";
import { useSchoolParametersQuery } from "../../features/parameters/api";
import {
  useEndOfYearOverviewQuery,
  useEndOfYearStatsQuery,
  useUpsertEndOfYearDecisionMutation,
} from "../../features/end-of-year/api";
import {
  DecisionRowEditor,
  NONE,
  RowEdit,
  emptyEdit,
  needsEnrollmentYear,
  needsTargetGroupe,
} from "../../features/end-of-year/components/DecisionRowEditor";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import StatCard from "../../components/StatCard";
import { SkeletonStatCard } from "../../components/Skeleton";
import PageHeader from "../../components/PageHeader";
import ConfirmDialog from "../../components/ConfirmDialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageTransition from "@/components/motion/PageTransition";
import { EndOfYearDecisionType, EndOfYearOverviewRow } from "../../types";
import { EndOfYearDecisionBadge } from "@/components/StatusBadge";
import { groupeLabel } from "@/lib/groupeLabel";
import { useSearchParamsState } from "../../hooks/useSearchParamsState";

// Reflète la demande utilisateur explicite (itération 43) : « à un certain
// moment, on doit arriver à une prise de décision. qui passe en classe
// supérieure ? qui redouble ? qui veut partir dans un autre établissement ?
// qui est réorienté vers une autre classe ? ». Quatre questions de cadrage
// via `AskUserQuestion` avant tout code (voir le doc d'archi projet,
// "Itération 43") : effet réel immédiat sur le groupe de l'élève pour
// PASSAGE/REORIENTATION/REDOUBLEMENT (jamais pour DEPART, étiquette
// informative seulement), suggestion automatique basée sur la moyenne
// annuelle (calculée côté serveur, jamais appliquée automatiquement),
// rôles ADMIN/GESTION_ELEVES seuls autorisés à écrire.
//
// Vue de travail "conseil de classe" : une classe à la fois (même patron
// que GradesPage "Bulletins & classement"/AttendancePage "Récapitulatif" —
// sélecteur de classe obligatoire avant tout appel réseau). Chaque ligne a
// son propre bouton "Enregistrer" plutôt qu'une sauvegarde groupée en un
// clic (à la différence d'AttendanceEntry, itération 13) : ici, valider une
// ligne peut réellement déplacer un élève vers une autre classe — une
// action plus conséquente qu'une simple présence, qui mérite une
// confirmation ligne par ligne plutôt qu'un lot silencieux.
//
// Itération 57 (Étape 4, Vague 4) — correctif de sécurité "Must" de l'audit
// (§6 : "Décision irréversible (déplacement de classe + inscription
// générée) validée sans ConfirmDialog") : une confirmation est désormais
// demandée avant tout enregistrement PASSAGE/REDOUBLEMENT/REORIENTATION
// (les trois décisions à effet réel — déplacement de classe et/ou
// inscription générée), PAS pour DEPART (étiquette informative seulement,
// aucune action physique déclenchée — voir `needsTargetGroupe`/
// `needsEnrollmentYear` dans DecisionRowEditor.tsx). Même principe que le
// correctif "poids d'évaluation" de GradesPage (itération 52) : on ne
// confirme que ce qui a un effet réel, pas chaque sauvegarde.
export default function EndOfYearPage() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const parametersQuery = useSchoolParametersQuery(school.id);
  const groupes = parametersQuery.data?.groupes ?? [];
  const classes = parametersQuery.data?.classes ?? [];
  const series = parametersQuery.data?.series ?? [];
  const schoolYears = parametersQuery.data?.schoolYears ?? [];

  const [groupeId, setGroupeId] = useSearchParamsState("classe");
  const [schoolYearId, setSchoolYearId] = useSearchParamsState("annee", school.currentSchoolYearId ?? "");

  // Itération 44 — l'année d'inscription générée sur PASSAGE/REDOUBLEMENT
  // est TOUJOURS choisie/confirmée par le personnel (cadrage AskUserQuestion :
  // jamais déduite silencieusement) — `SchoolYear.order` sert uniquement à
  // préremplir une valeur par défaut sensée ("l'année suivante") dans le
  // sélecteur, relative à l'année scolaire actuellement revue ci-dessus.
  const nextSchoolYearId = (() => {
    const currentOrder = schoolYears.find((y) => y.id === schoolYearId)?.order;
    if (currentOrder === undefined) return NONE;
    const next = schoolYears.filter((y) => y.order > currentOrder).sort((a, b) => a.order - b.order)[0];
    return next?.id ?? NONE;
  })();

  const statsQuery = useEndOfYearStatsQuery(school.id, schoolYearId || undefined, groupeId || undefined);
  const overviewQuery = useEndOfYearOverviewQuery(school.id, groupeId || undefined, schoolYearId || undefined);
  const upsertMutation = useUpsertEndOfYearDecisionMutation(school.id);

  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  // Ligne dont la sauvegarde attend confirmation — voir le commentaire de
  // tête de fichier. `null` quand aucune confirmation n'est en attente.
  const [pendingSaveId, setPendingSaveId] = useState<string | null>(null);
  // Ligne dont la mutation `upsertMutation` est actuellement en vol — permet
  // de désactiver le bon bouton "Enregistrer" (celui de LA ligne concernée,
  // pas tous les boutons de la classe) pendant la requête.
  const [savingId, setSavingId] = useState<string | null>(null);

  // Repart des données serveur (décision déjà enregistrée cette année pour
  // cet élève, sinon la suggestion) à chaque changement de classe/année —
  // jamais d'un état partiel précédent, même principe que AttendanceEntry
  // (itération 13) : la source de vérité reste le serveur.
  useEffect(() => {
    if (!overviewQuery.data) {
      setEdits({});
      return;
    }
    const next: Record<string, RowEdit> = {};
    for (const row of overviewQuery.data) {
      const decision = row.decision?.decision ?? row.suggestedDecision ?? NONE;
      next[row.student.id] = {
        decision,
        targetGroupeId: row.decision?.targetGroupeId ?? NONE,
        enrollmentSchoolYearId:
          row.decision?.enrollmentSchoolYearId ?? (needsEnrollmentYear(decision) ? nextSchoolYearId : NONE),
        note: row.decision?.note ?? "",
      };
    }
    setEdits(next);
  }, [overviewQuery.data]);

  function updateEdit(studentId: string, patch: Partial<RowEdit>) {
    setEdits((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] ?? emptyEdit), ...patch } }));
  }

  function requestSave(studentId: string) {
    const edit = edits[studentId] ?? emptyEdit;
    if (edit.decision === NONE) {
      toast.error("Choisissez une décision.");
      return;
    }
    if (needsTargetGroupe(edit.decision) && edit.targetGroupeId === NONE) {
      toast.error("Choisissez la classe de destination.");
      return;
    }
    if (needsEnrollmentYear(edit.decision) && edit.enrollmentSchoolYearId === NONE) {
      toast.error("Choisissez l'année scolaire de la nouvelle inscription.");
      return;
    }
    // Confirmation seulement pour les décisions à effet réel — voir le
    // commentaire de tête de fichier.
    if (needsTargetGroupe(edit.decision) || needsEnrollmentYear(edit.decision)) {
      setPendingSaveId(studentId);
      return;
    }
    void performSave(studentId);
  }

  async function performSave(studentId: string) {
    const edit = edits[studentId] ?? emptyEdit;
    setSavingId(studentId);
    try {
      await upsertMutation.mutateAsync({
        studentId,
        schoolYearId,
        decision: edit.decision as EndOfYearDecisionType,
        targetGroupeId: edit.targetGroupeId !== NONE ? edit.targetGroupeId : undefined,
        enrollmentSchoolYearId: edit.enrollmentSchoolYearId !== NONE ? edit.enrollmentSchoolYearId : undefined,
        note: edit.note.trim() || undefined,
      });
      toast.success("Décision enregistrée.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Enregistrement impossible.");
    } finally {
      setSavingId(null);
    }
  }

  async function confirmAndSave() {
    if (!pendingSaveId) return;
    await performSave(pendingSaveId);
    setPendingSaveId(null);
  }

  const pendingRow = overviewQuery.data?.find((r) => r.student.id === pendingSaveId);
  const pendingEdit = pendingSaveId ? edits[pendingSaveId] ?? emptyEdit : emptyEdit;
  const pendingTargetGroupeLabel =
    pendingEdit.targetGroupeId !== NONE
      ? groupeLabel(groupes.find((g) => g.id === pendingEdit.targetGroupeId) ?? { name: "?", classeId: "" }, classes, series)
      : null;
  const pendingEnrollmentYearLabel =
    pendingEdit.enrollmentSchoolYearId !== NONE
      ? schoolYears.find((y) => y.id === pendingEdit.enrollmentSchoolYearId)?.label
      : null;

  const columns: DataTableColumn<EndOfYearOverviewRow>[] = [
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
      header: "Moyenne annuelle",
      cell: (r) =>
        r.annualAverage !== null ? r.annualAverage.toFixed(2) : <span className="text-muted-foreground">—</span>,
    },
    {
      header: "Suggestion",
      cell: (r) =>
        r.suggestedDecision ? (
          <EndOfYearDecisionBadge decision={r.suggestedDecision} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: "Décision",
      cell: (r) => (
        <DecisionRowEditor
          edit={edits[r.student.id] ?? emptyEdit}
          groupes={groupes}
          classes={classes}
          series={series}
          schoolYears={schoolYears}
          nextSchoolYearId={nextSchoolYearId}
          generatedEnrollmentId={r.decision?.generatedEnrollmentId}
          onChange={(patch) => updateEdit(r.student.id, patch)}
          onSave={() => requestSave(r.student.id)}
          saving={savingId === r.student.id}
        />
      ),
    },
  ];

  const stats = statsQuery.data;

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Décisions de fin d'année"
        description="Passage en classe supérieure, redoublement, départ ou réorientation — classe par classe, à la fin de l'année scolaire."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="eoy-groupe" className="text-xs text-muted-foreground">Classe</Label>
          <Select value={groupeId} onValueChange={setGroupeId}>
            <SelectTrigger id="eoy-groupe" className="w-48">
              <SelectValue placeholder="Choisir une classe…" />
            </SelectTrigger>
            <SelectContent>
              {groupes.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {groupeLabel(g, classes, series)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eoy-school-year" className="text-xs text-muted-foreground">Année scolaire</Label>
          <Select value={schoolYearId} onValueChange={setSchoolYearId}>
            <SelectTrigger id="eoy-school-year" className="w-40">
              <SelectValue placeholder="Choisir une année…" />
            </SelectTrigger>
            <SelectContent>
              {schoolYears.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!schoolYearId ? (
        <p className="text-sm text-muted-foreground">Choisissez une année scolaire pour commencer.</p>
      ) : statsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
      ) : (
        stats && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Élèves" value={stats.totalStudents} hint={groupeId ? "de cette classe" : "de l'école"} />
            <StatCard label="En attente" value={stats.pending} />
            <StatCard label="Passages" value={stats.passage} />
            <StatCard label="Redoublements" value={stats.redoublement} />
            <StatCard label="Départs" value={stats.depart} />
            <StatCard label="Réorientations" value={stats.reorientation} />
          </div>
        )
      )}

      {!groupeId ? (
        <p className="text-sm text-muted-foreground">Choisissez une classe pour revoir la situation de chaque élève.</p>
      ) : (
        <DataTable
          columns={columns}
          data={overviewQuery.data ?? []}
          rowKey={(r) => r.student.id}
          loading={overviewQuery.isLoading}
          emptyMessage="Aucun élève dans cette classe."
          pageSize={50}
        />
      )}

      <ConfirmDialog
        open={pendingSaveId !== null}
        onOpenChange={(open) => !open && setPendingSaveId(null)}
        title="Confirmer cette décision de fin d'année ?"
        description={
          pendingRow ? (
            <>
              {pendingRow.student.fullName} —{" "}
              {pendingEdit.decision === "PASSAGE" && "Passage en classe supérieure"}
              {pendingEdit.decision === "REDOUBLEMENT" && "Redoublement"}
              {pendingEdit.decision === "REORIENTATION" && "Réorientation"}
              {pendingTargetGroupeLabel && <> : déplacement vers {pendingTargetGroupeLabel}</>}
              {pendingEnrollmentYearLabel && <> ; une inscription sera générée pour {pendingEnrollmentYearLabel}</>}
              . Cette action est irréversible.
            </>
          ) : (
            "Cette action est irréversible."
          )
        }
        confirmLabel="Confirmer"
        variant="default"
        onConfirm={confirmAndSave}
        loading={upsertMutation.isPending}
        loadingLabel="Enregistrement…"
      />
    </PageTransition>
  );
}
