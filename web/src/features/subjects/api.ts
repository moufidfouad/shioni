import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Subject } from "@/types";

export const subjectsKeys = {
  list: (schoolId: string) => ["subjects", schoolId] as const,
};

export function useSubjectsQuery(schoolId: string) {
  return useQuery({
    queryKey: subjectsKeys.list(schoolId),
    queryFn: async ({ signal }) =>
      (await api.get<Subject[]>(`/schools/${schoolId}/subjects`, { signal }))
        .data,
  });
}

function useInvalidateSubjects(schoolId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: subjectsKeys.list(schoolId) });
}

export function useCreateSubjectMutation(schoolId: string) {
  const invalidate = useInvalidateSubjects(schoolId);
  return useMutation({
    mutationFn: async (payload: { name: string; obligatoire: boolean }) =>
      (await api.post(`/schools/${schoolId}/subjects`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateSubjectMutation(schoolId: string) {
  const invalidate = useInvalidateSubjects(schoolId);
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: { name: string; obligatoire: boolean };
    }) =>
      (await api.patch(`/schools/${schoolId}/subjects/${id}`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteSubjectMutation(schoolId: string) {
  const invalidate = useInvalidateSubjects(schoolId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/schools/${schoolId}/subjects/${id}`)).data,
    onSuccess: invalidate,
  });
}

export function useSetCoefficientsMutation(schoolId: string) {
  const invalidate = useInvalidateSubjects(schoolId);
  return useMutation({
    mutationFn: async ({
      subjectId,
      coefficients,
    }: {
      subjectId: string;
      coefficients: {
        groupeId: string;
        coefficient: number;
        hoursPerWeek?: number;
        teacherId?: string;
      }[];
    }) =>
      (
        await api.put(
          `/schools/${schoolId}/subjects/${subjectId}/coefficients`,
          coefficients,
        )
      ).data,
    onSuccess: invalidate,
  });
}

export function useDeleteCoefficientMutation(schoolId: string) {
  const invalidate = useInvalidateSubjects(schoolId);
  return useMutation({
    mutationFn: async ({
      subjectId,
      groupeId,
    }: {
      subjectId: string;
      groupeId: string;
    }) =>
      (
        await api.delete(
          `/schools/${schoolId}/subjects/${subjectId}/coefficients/${groupeId}`,
        )
      ).data,
    onSuccess: invalidate,
  });
}
