import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { TimetableEntry } from "@/types";

// Filtres de la liste — même patron que les autres fichiers `queries/` :
// tout envoyé au serveur et intégré à la query key.
export interface TimetableFilters {
  groupeId?: string;
  day?: string;
  teacherName?: string;
  // Itération 35 — filtres par structure pédagogique + par salle.
  cycleId?: string;
  classeId?: string;
  serieId?: string;
  salleId?: string;
}

export const timetableKeys = {
  all: (schoolId: string) => ["timetable", schoolId] as const,
  list: (schoolId: string, filters: TimetableFilters) =>
    ["timetable", schoolId, "list", filters] as const,
};

export function useTimetableQuery(
  schoolId: string,
  filters: TimetableFilters = {},
) {
  return useQuery({
    queryKey: timetableKeys.list(schoolId, filters),
    queryFn: async ({ signal }) =>
      (
        await api.get<TimetableEntry[]>(`/schools/${schoolId}/timetable`, {
          params: {
            groupeId: filters.groupeId || undefined,
            day: filters.day || undefined,
            teacherName: filters.teacherName || undefined,
            cycleId: filters.cycleId || undefined,
            classeId: filters.classeId || undefined,
            serieId: filters.serieId || undefined,
            salleId: filters.salleId || undefined,
          },
          signal,
        })
      ).data,
  });
}

function useInvalidateTimetable(schoolId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: timetableKeys.all(schoolId) });
}

export function useCreateTimetableEntryMutation(schoolId: string) {
  const invalidate = useInvalidateTimetable(schoolId);
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (
        await api.post<TimetableEntry>(
          `/schools/${schoolId}/timetable`,
          payload,
        )
      ).data,
    onSuccess: invalidate,
  });
}

export function useUpdateTimetableEntryMutation(schoolId: string) {
  const invalidate = useInvalidateTimetable(schoolId);
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) =>
      (
        await api.patch<TimetableEntry>(
          `/schools/${schoolId}/timetable/${id}`,
          payload,
        )
      ).data,
    onSuccess: invalidate,
  });
}

export function useDeleteTimetableEntryMutation(schoolId: string) {
  const invalidate = useInvalidateTimetable(schoolId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/schools/${schoolId}/timetable/${id}`)).data,
    onSuccess: invalidate,
  });
}
