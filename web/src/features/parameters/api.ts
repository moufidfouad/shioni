import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { SchoolParameters } from "@/types";
import { schoolsKeys } from "../schools/api";

export const parametersKeys = {
  detail: (schoolId: string) => ["parameters", schoolId] as const,
};


export function useSchoolParametersQuery(schoolId: string) {
  return useQuery({
    queryKey: parametersKeys.detail(schoolId),
    queryFn: async ({ signal }) => (await api.get<SchoolParameters>(`/schools/${schoolId}/parameters`, { signal })).data,
  });
}

function useInvalidateParameters(schoolId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: parametersKeys.detail(schoolId) });
}

export function useSavePedagogyMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (payload: Record<string, number>) =>
      (await api.patch(`/schools/${schoolId}/parameters`, payload)).data,
    onSuccess: invalidate,
  });
}


export function useSetFeeLevelsMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (levels: { classeId: string; amount: number; monthlyAmount?: number }[]) =>
      (await api.put(`/schools/${schoolId}/parameters/fee-levels`, levels)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteFeeLevelMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (feeLevelId: string) =>
      (await api.delete(`/schools/${schoolId}/parameters/fee-levels/${feeLevelId}`)).data,
    onSuccess: invalidate,
  });
}


export function useUpsertCycleMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (payload: { id?: string; name: string; order?: number }) =>
      (await api.post(`/schools/${schoolId}/parameters/cycles`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteCycleMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (cycleId: string) => (await api.delete(`/schools/${schoolId}/parameters/cycles/${cycleId}`)).data,
    onSuccess: invalidate,
  });
}

export function useUpsertClasseMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (payload: { id?: string; cycleId: string; name: string; order?: number }) =>
      (await api.post(`/schools/${schoolId}/parameters/classes`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteClasseMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (classeId: string) => (await api.delete(`/schools/${schoolId}/parameters/classes/${classeId}`)).data,
    onSuccess: invalidate,
  });
}

export function useUpsertSerieMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (payload: { id?: string; classeId: string; name: string; order?: number }) =>
      (await api.post(`/schools/${schoolId}/parameters/series`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteSerieMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (serieId: string) => (await api.delete(`/schools/${schoolId}/parameters/series/${serieId}`)).data,
    onSuccess: invalidate,
  });
}

export function useUpsertGroupeMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (payload: {
      id?: string;
      name: string;
      classeId: string;
      serieId?: string | null;
      targetSize?: number;
    }) => (await api.post(`/schools/${schoolId}/parameters/groupes`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteGroupeMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (groupeId: string) => (await api.delete(`/schools/${schoolId}/parameters/groupes/${groupeId}`)).data,
    onSuccess: invalidate,
  });
}

export function useUpsertSalleMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (payload: { id?: string; name: string; capacity?: number; type?: string }) =>
      (await api.post(`/schools/${schoolId}/parameters/salles`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteSalleMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (salleId: string) => (await api.delete(`/schools/${schoolId}/parameters/salles/${salleId}`)).data,
    onSuccess: invalidate,
  });
}

export function useUpsertSchoolYearMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (payload: { id?: string; label: string; order?: number }) =>
      (await api.post(`/schools/${schoolId}/parameters/school-years`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteSchoolYearMutation(schoolId: string) {
  const invalidate = useInvalidateParameters(schoolId);
  return useMutation({
    mutationFn: async (schoolYearId: string) =>
      (await api.delete(`/schools/${schoolId}/parameters/school-years/${schoolYearId}`)).data,
    onSuccess: invalidate,
  });
}

export function useSetCurrentSchoolYearMutation(schoolId: string) {
  const invalidateParameters = useInvalidateParameters(schoolId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (schoolYearId: string | null) =>
      (await api.put(`/schools/${schoolId}/parameters/current-school-year`, { schoolYearId })).data,
    onSuccess: () => {
      invalidateParameters();
      queryClient.invalidateQueries({ queryKey: schoolsKeys.all });
      queryClient.invalidateQueries({ queryKey: schoolsKeys.detail(schoolId) });
    },
  });
}
