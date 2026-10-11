import { Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeeStatusBadge, AttendanceStatusBadge } from "./StatusBadge";
import { ChildSummary } from "../types";

const MENTION_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  Excellent: "default",
  "Très bien": "default",
  Bien: "secondary",
};

// Nombre de lignes de présence affichées avant troncature (audit §4.4 : liste
// tronquée à 30 lignes sans indicateur "30 sur N" — voir la note ci-dessous
// dans le rendu de la carte Présences).
const ATTENDANCE_HISTORY_LIMIT = 30;

interface StudentSummaryPanelProps {
  summary: ChildSummary;
  currency: string;
  trimestre: number;
  trimestreOptions: number[];
  onTrimestreChange: (trimestre: number) => void;
}

// Composant partagé, extrait à l'itération 58 (audit §4.4/§5 point 5 :
// ParentPortalPage.tsx/StudentPortalPage.tsx étaient ~120 lignes quasi
// identiques — carte élève, frais de scolarité, historique de présences,
// bulletin). Suit la convention actée à l'itération 57 pour RecordPaymentForm
// : un composant réellement partagé à l'identique entre deux MODULES
// distincts (ici parent-portal et student-portal) va directement dans
// `components/`, pas dans un `features/<module>/components/` qui laisserait
// croire qu'il appartient à l'un des deux modules plutôt qu'aux deux.
// `ChildSummary`/`MyStudentSummary` sont déjà le même type (voir
// `types/index.ts`) — aucune adaptation de shape nécessaire entre les deux
// pages appelantes, seul le contenu de `summary` (et son typage nominal)
// diffère selon l'appelant.
export default function StudentSummaryPanel({
  summary,
  currency,
  trimestre,
  trimestreOptions,
  onTrimestreChange,
}: StudentSummaryPanelProps) {
  const attendanceTotal = summary.attendance.length;
  const attendanceShown = summary.attendance.slice(0, ATTENDANCE_HISTORY_LIMIT);
  const attendanceTruncated = attendanceTotal > ATTENDANCE_HISTORY_LIMIT;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {summary.student.fullName}
            {/* Itération 113 — `groupeLabel` (composé côté serveur, ex "6ème A")
                remplace le `groupe.name` brut (ex "A" seul, ambigu) affiché ici
                jusque-là ; `groupe.name` reste un filet de sécurité si jamais
                `groupeLabel` manquait (ne devrait pas arriver, les deux viennent
                du même backend). */}
            {(summary.student.groupeLabel ?? summary.student.groupe?.name) && (
              <span className="ml-2 font-normal text-muted-foreground">
                · {summary.student.groupeLabel ?? summary.student.groupe?.name}
              </span>
            )}
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Landmark className="size-4 text-muted-foreground" /> Frais de scolarité
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune inscription enregistrée.</p>
            ) : (
              <ul className="space-y-2">
                {summary.enrollments.map((e) => (
                  <li key={e.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{e.schoolYear.label}</span>
                    <span className="tabular-nums">
                      {Number(e.amountPaid).toLocaleString("fr-FR")} / {Number(e.feeDue).toLocaleString("fr-FR")} {currency}
                    </span>
                    <FeeStatusBadge status={e.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Présences (historique)</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.attendance.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun enregistrement de présence.</p>
            ) : (
              <>
                <ul className="max-h-56 space-y-1.5 overflow-y-auto text-sm">
                  {attendanceShown.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{a.date.slice(0, 10)}</span>
                      <AttendanceStatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
                {attendanceTruncated && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {attendanceShown.length} sur {attendanceTotal}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <CardTitle className="text-sm">Bulletin</CardTitle>
          <Select value={String(trimestre)} onValueChange={(v) => onTrimestreChange(Number(v))}>
            <SelectTrigger className="w-32">
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
        </CardHeader>
        <CardContent>
          {!summary.bulletin ? (
            <p className="text-sm text-muted-foreground">Aucune note enregistrée pour ce trimestre pour le moment.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  Moyenne générale :{" "}
                  <span className="font-semibold text-foreground">
                    {summary.bulletin.average !== null ? summary.bulletin.average.toFixed(2) : "—"}
                  </span>{" "}
                  / {summary.bulletin.noteMax}
                </span>
                <span className="text-sm text-muted-foreground">
                  Rang : <span className="font-semibold text-foreground">{summary.bulletin.rank ?? "—"}</span> /{" "}
                  {summary.bulletin.classSize}
                </span>
                {summary.bulletin.mention && (
                  <Badge variant={MENTION_VARIANT[summary.bulletin.mention] ?? "secondary"}>
                    {summary.bulletin.mention}
                  </Badge>
                )}
              </div>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Matière</th>
                      <th className="px-3 py-2">Coef.</th>
                      <th className="px-3 py-2">Moyenne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.bulletin.subjects.map((s) => (
                      <tr key={s.subjectId} className="border-t">
                        <td className="px-3 py-2">{s.subjectName}</td>
                        <td className="px-3 py-2">{s.coefficient}</td>
                        <td className="px-3 py-2">{s.average !== null ? s.average.toFixed(2) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
