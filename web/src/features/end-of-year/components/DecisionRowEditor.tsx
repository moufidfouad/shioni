import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EndOfYearDecisionType } from "@/types";
import { groupeLabel } from "@/lib/groupeLabel";

export const DECISION_LABELS: Record<EndOfYearDecisionType, string> = {
  PASSAGE: "Passage en classe supérieure",
  REDOUBLEMENT: "Redoublement",
  DEPART: "Départ (autre établissement)",
  REORIENTATION: "Réorientation",
};


export const NONE = "__none__";

export function needsTargetGroupe(decision: string): boolean {
  return decision === "PASSAGE" || decision === "REORIENTATION";
}


export function needsEnrollmentYear(decision: string): boolean {
  return decision === "PASSAGE" || decision === "REDOUBLEMENT";
}

export interface RowEdit {
  decision: string; // EndOfYearDecisionType | NONE
  targetGroupeId: string; // groupeId | NONE
  enrollmentSchoolYearId: string; // schoolYearId | NONE — itération 44
  note: string;
}

export const emptyEdit: RowEdit = { decision: NONE, targetGroupeId: NONE, enrollmentSchoolYearId: NONE, note: "" };


export function DecisionRowEditor({
  edit,
  groupes,
  classes,
  series,
  schoolYears,

  nextSchoolYearId,
  generatedEnrollmentId,
  onChange,
  onSave,
  saving,
}: {
  edit: RowEdit;
  groupes: { id: string; name: string; classeId: string; serieId?: string | null }[];
  classes: { id: string; name: string }[];
  series: { id: string; name: string }[];
  schoolYears: { id: string; label: string }[];
  nextSchoolYearId: string;
  generatedEnrollmentId?: string | null;
  onChange: (patch: Partial<RowEdit>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select
        value={edit.decision}
        onValueChange={(v) =>
          onChange({
            decision: v,
            ...(needsTargetGroupe(v) ? {} : { targetGroupeId: NONE }),
            ...(needsEnrollmentYear(v)
              ? { enrollmentSchoolYearId: edit.enrollmentSchoolYearId !== NONE ? edit.enrollmentSchoolYearId : nextSchoolYearId }
              : { enrollmentSchoolYearId: NONE }),
          })
        }
      >
        <SelectTrigger className="w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— Aucune —</SelectItem>
          {(Object.keys(DECISION_LABELS) as EndOfYearDecisionType[]).map((d) => (
            <SelectItem key={d} value={d}>
              {DECISION_LABELS[d]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {needsTargetGroupe(edit.decision) && (
        <Select value={edit.targetGroupeId} onValueChange={(v) => onChange({ targetGroupeId: v })}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Classe cible…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE} disabled>
              Choisir une classe…
            </SelectItem>
            {groupes.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {groupeLabel(g, classes, series)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {needsEnrollmentYear(edit.decision) && (
        <div className="space-y-1">
          <Select value={edit.enrollmentSchoolYearId} onValueChange={(v) => onChange({ enrollmentSchoolYearId: v })}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Année d'inscription…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                Choisir une année…
              </SelectItem>
              {schoolYears.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {generatedEnrollmentId && <p className="text-xs text-muted-foreground">Inscription déjà générée.</p>}
        </div>
      )}

      <Input
        placeholder="Note (optionnel)"
        className="w-40"
        value={edit.note}
        onChange={(e) => onChange({ note: e.target.value })}
      />

      <Button size="sm" onClick={onSave} disabled={saving}>
        {saving ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
}
