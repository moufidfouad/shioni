import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import {
  FeeStatus,
  GenerateTuitionFeesResult,
  Paginated,
  TuitionFee,
  TuitionFeeStats,
} from "@/types";

export interface TuitionFeeFilters {
  schoolYearId?: string;
  month?: number;
  status?: FeeStatus;
  groupeId?: string;
  search?: string;
}

export interface PageParams {
  page?: number;
  pageSize?: number;
}

export const tuitionKeys = {
  all: (schoolId: string) => ["tuition-fees", schoolId] as const,
  list: (schoolId: string, filters: TuitionFeeFilters, page: PageParams) =>
    ["tuition-fees", schoolId, "list", filters, page] as const,
  stats: (
    schoolId: string,
    schoolYearId?: string,
    month?: number,
    groupeId?: string,
  ) =>
    ["tuition-fees", schoolId, "stats", schoolYearId, month, groupeId] as const,
};

export function useTuitionFeesQuery(
  schoolId: string,
  filters: TuitionFeeFilters,
  page: PageParams = {},
) {
  return useQuery({
    queryKey: tuitionKeys.list(schoolId, filters, page),
    queryFn: async ({ signal }) =>
      (
        await api.get<Paginated<TuitionFee>>(
          `/schools/${schoolId}/tuition-fees`,
          {
            params: {
              schoolYearId: filters.schoolYearId || undefined,
              month: filters.month || undefined,
              status: filters.status || undefined,
              groupeId: filters.groupeId || undefined,
              search: filters.search || undefined,
              page: page.page,
              pageSize: page.pageSize,
            },
            signal,
          },
        )
      ).data,
  });
}


export function useTuitionFeeStatsQuery(
  schoolId: string,
  schoolYearId?: string,
  month?: number,
  groupeId?: string,
) {
  return useQuery({
    queryKey: tuitionKeys.stats(schoolId, schoolYearId, month, groupeId),
    queryFn: async ({ signal }) =>
      (
        await api.get<TuitionFeeStats>(
          `/schools/${schoolId}/tuition-fees/stats`,
          {
            params: {
              schoolYearId: schoolYearId || undefined,
              month: month || undefined,
              groupeId: groupeId || undefined,
            },
            signal,
          },
        )
      ).data,
  });
}

function useInvalidateTuitionFees(schoolId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: tuitionKeys.all(schoolId) });
}

export interface TuitionFeePayload {
  studentId: string;
  schoolYearId: string;
  month: number;
  amountDue: number;
  amountPaid?: number;
  discountAmount?: number;
  discountReason?: string;
  paymentMode?: string;
  paymentDate?: string;
}

export function useCreateTuitionFeeMutation(schoolId: string) {
  const invalidate = useInvalidateTuitionFees(schoolId);
  return useMutation({
    mutationFn: async (payload: TuitionFeePayload) =>
      (await api.post(`/schools/${schoolId}/tuition-fees`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateTuitionFeeMutation(schoolId: string) {
  const invalidate = useInvalidateTuitionFees(schoolId);
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<TuitionFeePayload>;
    }) =>
      (await api.patch(`/schools/${schoolId}/tuition-fees/${id}`, payload))
        .data,
    onSuccess: invalidate,
  });
}

export function useRecordTuitionPaymentMutation(schoolId: string) {
  const invalidate = useInvalidateTuitionFees(schoolId);
  return useMutation({
    mutationFn: async ({
      id,
      amount,
      paymentMode,
      paymentDate,
    }: {
      id: string;
      amount: number;
      paymentMode?: string;
      paymentDate?: string;
    }) =>
      (
        await api.post(`/schools/${schoolId}/tuition-fees/${id}/payments`, {
          amount,
          paymentMode,
          paymentDate,
        })
      ).data,
    onSuccess: invalidate,
  });
}

export function useDeleteTuitionFeeMutation(schoolId: string) {
  const invalidate = useInvalidateTuitionFees(schoolId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/schools/${schoolId}/tuition-fees/${id}`)).data,
    onSuccess: invalidate,
  });
}

export interface GenerateTuitionFeesPayload {
  schoolYearId: string;
  groupeId?: string;
  months: number[];
  discountAmount?: number;
  discountReason?: string;
}

// Génération en masse — cadrage utilisateur explicite (voir tuition.schema.ts
// côté backend). Invalide toute la liste comme les autres mutations : le
// nombre de lignes créées change potentiellement la pagination/les stats.
export function useGenerateTuitionFeesMutation(schoolId: string) {
  const invalidate = useInvalidateTuitionFees(schoolId);
  return useMutation({
    mutationFn: async (payload: GenerateTuitionFeesPayload) =>
      (
        await api.post<GenerateTuitionFeesResult>(
          `/schools/${schoolId}/tuition-fees/generate`,
          payload,
        )
      ).data,
    onSuccess: invalidate,
  });
}
