import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { TimetableEntry } from "../types";

// GET /schools/:schoolId/timetable — route WEB existante (timetable.routes.ts,
// requireAnySchoolRole), réutilisée telle quelle. Personnel uniquement — voir
// timetable.tsx (`useMyTimetableQuery` dans src/api/studentPortal.ts et
// `useChildTimetableQuery` dans src/api/parentPortal.ts pour les deux autres
// profils, chacun à sa propre route dédiée).
export function useTimetableQuery(schoolId: string | undefined, groupeId: string | undefined) {
  return useQuery({
    queryKey: ["timetable", schoolId, groupeId],
    queryFn: async () => {
      const { data } = await api.get<TimetableEntry[]>(`/schools/${schoolId}/timetable`, {
        params: { groupeId },
      });
      return data;
    },
    enabled: Boolean(schoolId) && Boolean(groupeId),
  });
}
