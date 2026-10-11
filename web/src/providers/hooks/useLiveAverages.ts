import { useMemo } from "react";
import { GradeLike } from "./useEvaluationSelection";


export function useLiveAverages({
  gradesData,
  students,
  activeLabel,
  activeWeight,
  edits,
  isExistingEvaluation,
}: {
  gradesData: GradeLike[] | undefined;
  students: { id: string }[];
  activeLabel: string;
  activeWeight: number;
  edits: Record<string, string>;
  isExistingEvaluation: boolean;
}): Map<string, number | null> {
  return useMemo(() => {
    const result = new Map<string, number | null>();
    for (const student of students) {
      const grade = gradesData?.find((g) => g.studentId === student.id);
      const merged = new Map<string, { value: number; weight: number }>();
      for (const ev of grade?.evaluations ?? []) {
        merged.set(ev.label, { value: Number(ev.value), weight: Number(ev.weight) });
      }
      if (activeLabel) {
        const raw = edits[student.id];
        if (raw !== undefined && raw !== "") {
          merged.set(activeLabel, { value: Number(raw), weight: activeWeight || 1 });
        } else if (isExistingEvaluation) {
          merged.delete(activeLabel);
        }
      }
      const values = [...merged.values()];
      const totalWeight = values.reduce((sum, v) => sum + v.weight, 0);
      const average = totalWeight <= 0 ? null : values.reduce((sum, v) => sum + v.value * v.weight, 0) / totalWeight;
      result.set(student.id, average);
    }
    return result;
  }, [gradesData, students, activeLabel, activeWeight, edits, isExistingEvaluation]);
}
