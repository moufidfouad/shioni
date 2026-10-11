import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Bulletin, Grade, Paginated, RankingRow } from "@/types";

// Filtres envoyés au serveur — mêmes conventions que `enrollments.ts`.
export interface GradeFilters {
  groupeId?: string;
  subjectId?: string;
  trimestre?: number;
  studentId?: string;
}

export const gradesKeys = {
  all: (schoolId: string) => ["grades", schoolId] as const,
  list: (schoolId: string, filters: GradeFilters) =>
    ["grades", schoolId, "list", filters] as const,
  ranking: (schoolId: string, groupeId: string, trimestre: number) =>
    ["grades", schoolId, "ranking", groupeId, trimestre] as const,
  bulletin: (schoolId: string, studentId: string, trimestre: number) =>
    ["grades", schoolId, "bulletin", studentId, trimestre] as const,
};


export function useGradesQuery(
  schoolId: string,
  filters: GradeFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: gradesKeys.list(schoolId, filters),
    enabled,
    queryFn: async ({ signal }) =>
      (
        await api.get<Paginated<Grade>>(`/schools/${schoolId}/grades`, {
          params: {
            groupeId: filters.groupeId || undefined,
            subjectId: filters.subjectId || undefined,
            trimestre: filters.trimestre || undefined,
            studentId: filters.studentId || undefined,
            all: true,
          },
          signal,
        })
      ).data.data,
  });
}

export function useClassRankingQuery(
  schoolId: string,
  groupeId: string,
  trimestre: number,
  enabled = true,
) {
  return useQuery({
    queryKey: gradesKeys.ranking(schoolId, groupeId, trimestre),
    enabled: enabled && Boolean(groupeId),
    queryFn: async ({ signal }) =>
      (
        await api.get<RankingRow[]>(`/schools/${schoolId}/grades/ranking`, {
          params: { groupeId, trimestre },
          signal,
        })
      ).data,
  });
}

export function useStudentBulletinQuery(
  schoolId: string,
  studentId: string,
  trimestre: number,
  enabled = true,
) {
  return useQuery({
    queryKey: gradesKeys.bulletin(schoolId, studentId, trimestre),
    enabled: enabled && Boolean(studentId),
    queryFn: async ({ signal }) =>
      (
        await api.get<Bulletin>(
          `/schools/${schoolId}/grades/bulletin/${studentId}`,
          {
            params: { trimestre },
            signal,
          },
        )
      ).data,
  });
}

function useInvalidateGrades(schoolId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: gradesKeys.all(schoolId) });
}


export interface BulkGradeEvaluationEntry {
  studentId: string;
  value: number | null;
}

export interface BulkGradeEvaluationPayload {
  groupeId: string;
  subjectId: string;
  trimestre: number;
  label: string;
  weight: number;
  entries: BulkGradeEvaluationEntry[];
}

export function useBulkSetGradeEvaluationMutation(schoolId: string) {
  const invalidate = useInvalidateGrades(schoolId);
  return useMutation({
    mutationFn: async (payload: BulkGradeEvaluationPayload) =>
      (await api.post(`/schools/${schoolId}/grades/bulk`, payload)).data,
    onSuccess: invalidate,
  });
}


export interface DeleteEvaluationPayload {
  groupeId: string;
  subjectId: string;
  trimestre: number;
  label: string;
}

export function useDeleteEvaluationForClassMutation(schoolId: string) {
  const invalidate = useInvalidateGrades(schoolId);
  return useMutation({
    mutationFn: async (payload: DeleteEvaluationPayload) =>
      (
        await api.delete(`/schools/${schoolId}/grades/bulk`, {
          params: payload,
        })
      ).data,
    onSuccess: invalidate,
  });
}
