import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { GuardianChild, StudentSummary, TimetableEntry } from "../types";

// GET /schools/:schoolId/parent/children[/:studentId/summary] — routes WEB
// existantes (parent-portal.routes.ts), réutilisées telles quelles. Aucun
// SchoolRole requis côté backend (parent-portal.routes.ts n'a PAS de
// requireAnySchoolRole — chaque fonction vérifie le lien StudentGuardian
// elle-même) : n'appeler ces routes QUE si `school.isGuardian` (voir
// app/(app)/schools/[schoolId]/dashboard.tsx), jamais en devinant.
export function useMyChildrenQuery(schoolId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["parent-portal", "children", schoolId],
    queryFn: async () => {
      const { data } = await api.get<GuardianChild[]>(`/schools/${schoolId}/parent/children`);
      return data;
    },
    enabled: Boolean(schoolId) && enabled,
  });
}

export function useChildSummaryQuery(
  schoolId: string | undefined,
  studentId: string | undefined,
  trimestre: number
) {
  return useQuery({
    queryKey: ["parent-portal", "child-summary", schoolId, studentId, trimestre],
    queryFn: async () => {
      const { data } = await api.get<StudentSummary>(
        `/schools/${schoolId}/parent/children/${studentId}/summary`,
        { params: { trimestre: trimestre || undefined } }
      );
      return data;
    },
    enabled: Boolean(schoolId) && Boolean(studentId),
  });
}

// GET /schools/:schoolId/parent/children/:studentId/timetable — nouvel
// endpoint (itération 72, parent-portal.routes.ts), même philosophie que
// getChildSummary ci-dessus : pas de SchoolRole requis, le backend vérifie
// lui-même le lien StudentGuardian (voir parent-portal.service.ts::
// getChildTimetable).
export function useChildTimetableQuery(schoolId: string | undefined, studentId: string | undefined) {
  return useQuery({
    queryKey: ["parent-portal", "child-timetable", schoolId, studentId],
    queryFn: async () => {
      const { data } = await api.get<TimetableEntry[]>(
        `/schools/${schoolId}/parent/children/${studentId}/timetable`
      );
      return data;
    },
    enabled: Boolean(schoolId) && Boolean(studentId),
  });
}
