import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { StudentSummary, TimetableEntry } from "../types";

// GET /schools/:schoolId/student/me/summary — route WEB existante
// (student-portal.routes.ts), réutilisée telle quelle. Comme le portail
// Parent, aucun SchoolRole requis côté backend — n'appeler cette route QUE
// si `school.isStudent` (voir dashboard.tsx).
export function useMySummaryQuery(schoolId: string | undefined, trimestre: number, enabled = true) {
  return useQuery({
    queryKey: ["student-portal", "my-summary", schoolId, trimestre],
    queryFn: async () => {
      const { data } = await api.get<StudentSummary>(`/schools/${schoolId}/student/me/summary`, {
        params: { trimestre: trimestre || undefined },
      });
      return data;
    },
    enabled: Boolean(schoolId) && enabled,
  });
}

// GET /schools/:schoolId/student/me/timetable — nouvel endpoint (itération
// 72, student-portal.routes.ts), même philosophie que useMySummaryQuery :
// pas de `groupeId` à fournir, le backend résout la classe de l'élève
// connecté lui-même (voir student-portal.service.ts::getMyTimetable).
export function useMyTimetableQuery(schoolId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["student-portal", "my-timetable", schoolId],
    queryFn: async () => {
      const { data } = await api.get<TimetableEntry[]>(`/schools/${schoolId}/student/me/timetable`);
      return data;
    },
    enabled: Boolean(schoolId) && enabled,
  });
}
