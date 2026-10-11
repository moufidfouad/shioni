import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { SchoolOutletContext } from "../../layouts/SchoolLayout";
import { useSchoolParametersQuery } from "../../features/parameters/api";
import { useStudentsQuery } from "../../features/students/api";
import { useMyTeachingScopeQuery } from "../../features/me/api";
import {
  useAttendanceQuery,
  useAttendanceStatsQuery,
  useBulkSetAttendanceMutation,
  useDeleteAttendanceMutation,
} from "../../features/attendance/api";
import DataTable, { DataTableColumn } from "../../components/DataTable";
import StatCard from "../../components/StatCard";
import { SkeletonStatCard } from "../../components/Skeleton";
import PageHeader from "../../components/PageHeader";
import ConfirmDialog from "../../components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageTransition from "@/components/motion/PageTransition";
import { AttendanceStatRow, AttendanceStatus, Classe, Serie, Student, TeachingScope } from "../../types";
import { AttendanceStatusBadge, PresenceRateBadge } from "@/components/StatusBadge";
import { groupeLabel } from "@/lib/groupeLabel";
import { useSearchParamsState } from "../../hooks/useSearchParamsState";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Itération 29 — un compte Enseignant restreint (voir useMyTeachingScopeQuery)
// ne doit voir/saisir que ses propres classes.
function filterGroupesByScope<T extends { id: string }>(groupes: T[], scope?: TeachingScope): T[] {
  if (!scope || !scope.restricted) return groupes;
  const allowed = new Set(scope.groupeIds);
  return groupes.filter((c) => allowed.has(c.id));
}

// Reflète la feuille Excel "PRESENCES", avec deux vues distinctes (choix
// documenté, pas de demande explicite, même patron que Grades.tsx à
// l'itération 11) : la saisie quotidienne (une classe + une date, un statut
// par élève — le workflow réel du cahier de présence rempli d'un coup pour
// toute la classe) et un récapitulatif d'assiduité sur une période (nombre
// de présences/absences/retards par élève + taux de présence, calculés côté
// serveur — voir attendance.service.ts::getAttendanceStats).
export default function Attendance() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const parametersQuery = useSchoolParametersQuery(school.id);
  const scopeQuery = useMyTeachingScopeQuery(school.id);
  const groupes = filterGroupesByScope(parametersQuery.data?.groupes ?? [], scopeQuery.data);
  const classes = parametersQuery.data?.classes ?? [];
  const series = parametersQuery.data?.series ?? [];

  const [view, setView] = useState<"saisie" | "recap">("saisie");

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        title="Présences"
        actions={
          <div className="flex gap-2">
            <Button variant={view === "saisie" ? "default" : "outline"} size="sm" onClick={() => setView("saisie")}>
              Saisie des présences
            </Button>
            <Button variant={view === "recap" ? "default" : "outline"} size="sm" onClick={() => setView("recap")}>
              Récapitulatif
            </Button>
          </div>
        }
      />

      {view === "saisie" ? (
        <AttendanceEntry schoolId={school.id} groupes={groupes} classes={classes} series={series} />
      ) : (
        <AttendanceSummary schoolId={school.id} groupes={groupes} classes={classes} series={series} />
      )}
    </PageTransition>
  );
}

// ----------------------------------------------------------------------------
// Vue "Saisie des présences"
// ----------------------------------------------------------------------------

interface Edit {
  status: AttendanceStatus;
  heure: string;
  motif: string;
  justifiee: boolean;
}

const defaultEdit: Edit = { status: "PRESENT", heure: "", motif: "", justifiee: false };

function AttendanceEntry({
  schoolId,
  groupes,
  classes,
  series,
}: {
  schoolId: string;
  groupes: { id: string; name: string; classeId: string; serieId?: string | null }[];
  classes: Pick<Classe, "id" | "name">[];
  series: Pick<Serie, "id" | "name">[];
}) {
  // Itération 57 (Étape 4, Vague 4) — filtres synchronisés à l'URL (audit
  // §7 : "toutes [les pages de la Vague 4] avec useSearchParams sur leurs
  // filtres"). `classe` est partagé avec AttendanceSummary ci-dessous (les
  // deux vues ne sont jamais montées en même temps), `date` est propre à la
  // saisie quotidienne (AttendanceSummary a `du`/`au`, une plage plutôt
  // qu'un jour précis).
  const [groupeId, setGroupeId] = useSearchParamsState("classe");
  const [date, setDate] = useSearchParamsState("date", todayIso());
  const [edits, setEdits] = useState<Record<string, Edit>>({});

  // `all: true` — le registre d'UNE classe est par nature borné (voir
  // features/students/api.ts::PageParams).
  const studentsQuery = useStudentsQuery(schoolId, { groupeId: groupeId || undefined }, { all: true });
  const students = useMemo(() => (groupeId ? studentsQuery.data?.data ?? [] : []), [groupeId, studentsQuery.data]);

  const ready = Boolean(groupeId && date);
  const attendanceQuery = useAttendanceQuery(schoolId, { groupeId, dateFrom: date, dateTo: date }, ready);
  const bulkSave = useBulkSetAttendanceMutation(schoolId);

  // Synchronise le brouillon d'édition avec les présences déjà enregistrées
  // pour cette classe et cette date (ou "Présent" par défaut pour un élève
  // sans enregistrement — la plupart des élèves sont présents chaque jour,
  // ça évite de tout cocher à la main) — on repart des valeurs serveur à
  // chaque changement de classe/date, jamais d'un état partiel précédent,
  // même principe que GradeEntry (itération 11).
  useEffect(() => {
    if (!ready || !attendanceQuery.data) {
      setEdits({});
      return;
    }
    const next: Record<string, Edit> = {};
    for (const student of students) {
      const existing = attendanceQuery.data.find((r) => r.studentId === student.id && !r.subject);
      next[student.id] = existing
        ? {
            status: existing.status,
            heure: existing.heure ?? "",
            motif: existing.motif ?? "",
            justifiee: existing.justifiee ?? false,
          }
        : { ...defaultEdit };
    }
    setEdits(next);
    // Intentionally depending on `students.length` rather than the `students`
    // array itself: `students` is a new array reference on every render of
    // the parent query, which would re-run this effect (and reset in-progress
    // edits) far more often than the data actually changes.
  }, [ready, attendanceQuery.data, students.length]);

  function updateEdit(studentId: string, patch: Partial<Edit>) {
    setEdits((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] ?? defaultEdit), ...patch } }));
  }

  async function handleSave() {
    try {
      await bulkSave.mutateAsync({
        groupeId,
        date,
        records: students.map((s) => {
          const e = edits[s.id] ?? defaultEdit;
          return {
            studentId: s.id,
            status: e.status,
            heure: e.heure || undefined,
            motif: e.motif || undefined,
            justifiee: e.status === "PRESENT" ? undefined : e.justifiee,
          };
        }),
      });
      toast.success("Présences enregistrées.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Enregistrement impossible.");
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
      header: "Statut",
      cell: (s) => {
        const status = edits[s.id]?.status ?? "PRESENT";
        return (
          <Select value={status} onValueChange={(v) => updateEdit(s.id, { status: v as AttendanceStatus })}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRESENT">Présent</SelectItem>
              <SelectItem value="RETARD">Retard</SelectItem>
              <SelectItem value="ABSENT">Absent</SelectItem>
            </SelectContent>
          </Select>
        );
      },
    },
    {
      header: "Heure",
      cell: (s) => {
        const status = edits[s.id]?.status ?? "PRESENT";
        if (status !== "RETARD") return <span className="text-muted-foreground">—</span>;
        return (
          <Input
            type="time"
            className="w-28"
            value={edits[s.id]?.heure ?? ""}
            onChange={(e) => updateEdit(s.id, { heure: e.target.value })}
          />
        );
      },
    },
    {
      header: "Motif",
      cell: (s) => {
        const status = edits[s.id]?.status ?? "PRESENT";
        if (status === "PRESENT") return <span className="text-muted-foreground">—</span>;
        return (
          <Input
            placeholder="ex : Maladie"
            className="w-40"
            value={edits[s.id]?.motif ?? ""}
            onChange={(e) => updateEdit(s.id, { motif: e.target.value })}
          />
        );
      },
    },
    {
      header: "Justifiée",
      cell: (s) => {
        const status = edits[s.id]?.status ?? "PRESENT";
        if (status === "PRESENT") return <span className="text-muted-foreground">—</span>;
        return (
          <Checkbox
            checked={edits[s.id]?.justifiee ?? false}
            onCheckedChange={(v) => updateEdit(s.id, { justifiee: v === true })}
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="attendance-entry-groupe" className="text-xs text-muted-foreground">Classe</Label>
          <Select value={groupeId} onValueChange={setGroupeId}>
            <SelectTrigger id="attendance-entry-groupe" className="w-48">
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
          <Label htmlFor="attendance-entry-date" className="text-xs text-muted-foreground">Date</Label>
          <Input id="attendance-entry-date" type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {!groupeId && <p className="text-sm text-muted-foreground">Choisissez une classe pour commencer la saisie.</p>}

      {ready && (
        <>
          <DataTable
            columns={columns}
            data={students}
            rowKey={(s) => s.id}
            loading={studentsQuery.isLoading || attendanceQuery.isLoading}
            emptyMessage="Aucun élève dans cette classe."
            pageSize={50}
          />
          {students.length > 0 && (
            <Button onClick={handleSave} disabled={bulkSave.isPending}>
              {bulkSave.isPending ? "Enregistrement…" : "Enregistrer les présences"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Vue "Récapitulatif"
// ----------------------------------------------------------------------------

function AttendanceSummary({
  schoolId,
  groupes,
  classes,
  series,
}: {
  schoolId: string;
  groupes: { id: string; name: string; classeId: string; serieId?: string | null }[];
  classes: Pick<Classe, "id" | "name">[];
  series: Pick<Serie, "id" | "name">[];
}) {
  // Itération 57 (Étape 4, Vague 4) — `classe` partagé avec AttendanceEntry
  // ci-dessus, voir son commentaire ; `du`/`au` propres à cette vue.
  const [groupeId, setGroupeId] = useSearchParamsState("classe");
  const [dateFrom, setDateFrom] = useSearchParamsState("du");
  const [dateTo, setDateTo] = useSearchParamsState("au");
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const statsQuery = useAttendanceStatsQuery(schoolId, groupeId, dateFrom || undefined, dateTo || undefined);
  const historyQuery = useAttendanceQuery(
    schoolId,
    { studentId: expandedStudentId ?? undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    Boolean(expandedStudentId)
  );
  const deleteAttendance = useDeleteAttendanceMutation(schoolId);

  useEffect(() => {
    setExpandedStudentId(null);
  }, [groupeId, dateFrom, dateTo]);

  async function confirmDeleteRecord() {
    if (!pendingDeleteId) return;
    try {
      await deleteAttendance.mutateAsync(pendingDeleteId);
      toast.success("Enregistrement supprimé.");
      setPendingDeleteId(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Suppression impossible.");
    }
  }

  const stats = statsQuery.data;

  const columns: DataTableColumn<AttendanceStatRow>[] = [
    {
      header: "Élève",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.student.fullName}</p>
          <p className="text-xs text-muted-foreground">{r.student.matricule}</p>
        </div>
      ),
    },
    { header: "Présent", cell: (r) => r.present },
    { header: "Retard", cell: (r) => r.retard },
    { header: "Absent", cell: (r) => (r.absent > 0 ? <span className="font-medium text-destructive">{r.absent}</span> : r.absent) },
    {
      header: "Taux de présence",
      cell: (r) =>
        r.tauxPresence !== null ? (
          <PresenceRateBadge rate={r.tauxPresence} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="attendance-summary-groupe" className="text-xs text-muted-foreground">Classe</Label>
          <Select value={groupeId} onValueChange={setGroupeId}>
            <SelectTrigger id="attendance-summary-groupe" className="w-48">
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
          <Label htmlFor="attendance-summary-date-from" className="text-xs text-muted-foreground">Du</Label>
          <Input id="attendance-summary-date-from" type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="attendance-summary-date-to" className="text-xs text-muted-foreground">Au</Label>
          <Input id="attendance-summary-date-to" type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {!groupeId ? (
        <p className="text-sm text-muted-foreground">Choisissez une classe pour voir son récapitulatif d'assiduité.</p>
      ) : (
        <>
          {statsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
            </div>
          ) : (
            stats && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Présences" value={stats.totals.present} />
                <StatCard label="Retards" value={stats.totals.retard} />
                <StatCard label="Absences" value={stats.totals.absent} />
                <StatCard
                  label="Taux de présence"
                  value={stats.totals.tauxPresence !== null ? `${stats.totals.tauxPresence.toFixed(0)} %` : "—"}
                />
              </div>
            )
          )}

          <DataTable
            columns={columns}
            data={stats?.students ?? []}
            rowKey={(r) => r.student.id}
            loading={statsQuery.isLoading}
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
                {expandedStudentId === r.student.id ? "Fermer" : "Détail"}
              </Button>
            )}
            renderExpandedRow={(r) => {
              if (expandedStudentId !== r.student.id) return null;
              if (historyQuery.isLoading) return <p className="py-2 text-sm text-muted-foreground">Chargement…</p>;
              const records = historyQuery.data ?? [];
              if (records.length === 0) return <p className="py-2 text-sm text-muted-foreground">Aucun enregistrement sur cette période.</p>;
              return (
                <ul className="divide-y py-2">
                  {records.map((rec) => (
                    <li key={rec.id} className="flex items-center justify-between py-2 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{rec.date.slice(0, 10)}</span>
                        <AttendanceStatusBadge status={rec.status} />
                        {rec.subject && <span className="text-xs text-muted-foreground">{rec.subject}</span>}
                        {rec.heure && <span className="text-xs text-muted-foreground">{rec.heure}</span>}
                        {rec.motif && <span className="text-xs text-muted-foreground">— {rec.motif}</span>}
                        {rec.justifiee && (
                          <Badge variant="secondary" className="text-xs">
                            Justifiée
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-destructive"
                        onClick={() => setPendingDeleteId(rec.id)}
                      >
                        Supprimer
                      </Button>
                    </li>
                  ))}
                </ul>
              );
            }}
          />
        </>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Supprimer cet enregistrement de présence ?"
        description="Cette action est irréversible."
        onConfirm={confirmDeleteRecord}
        loading={deleteAttendance.isPending}
      />
    </div>
  );
}
