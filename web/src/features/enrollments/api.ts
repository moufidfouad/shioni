import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Enrollment, EnrollmentStats, FeeStatus, Paginated } from "@/types";

export interface EnrollmentFilters {
  schoolYearId?: string;
  status?: FeeStatus;
  groupeId?: string;
  search?: string;
}

export interface PageParams {
  page?: number;
  pageSize?: number;
}

export const enrollmentsKeys = {
  all: (schoolId: string) => ["enrollments", schoolId] as const,
  list: (schoolId: string, filters: EnrollmentFilters, page: PageParams) =>
    ["enrollments", schoolId, "list", filters, page] as const,
  stats: (schoolId: string, schoolYearId?: string, groupeId?: string) =>
    ["enrollments", schoolId, "stats", schoolYearId, groupeId] as const,
};

export function useEnrollmentsQuery(
  schoolId: string,
  filters: EnrollmentFilters,
  page: PageParams = {},
) {
  return useQuery({
    queryKey: enrollmentsKeys.list(schoolId, filters, page),
    queryFn: async ({ signal }) =>
      (
        await api.get<Paginated<Enrollment>>(
          `/schools/${schoolId}/enrollments`,
          {
            params: {
              schoolYearId: filters.schoolYearId || undefined,
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

export function useEnrollmentStatsQuery(
  schoolId: string,
  schoolYearId?: string,
  groupeId?: string,
) {
  return useQuery({
    queryKey: enrollmentsKeys.stats(schoolId, schoolYearId, groupeId),
    queryFn: async ({ signal }) =>
      (
        await api.get<EnrollmentStats>(
          `/schools/${schoolId}/enrollments/stats`,
          {
            params: {
              schoolYearId: schoolYearId || undefined,
              groupeId: groupeId || undefined,
            },
            signal,
          },
        )
      ).data,
  });
}

function useInvalidateEnrollments(schoolId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: enrollmentsKeys.all(schoolId) });
}

export interface EnrollmentPayload {
  studentId: string;
  schoolYearId: string;
  feeDue: number;
  amountPaid?: number;
  discountAmount?: number;
  discountReason?: string;
  paymentMode?: string;
  paymentDate?: string;
}

export function useCreateEnrollmentMutation(schoolId: string) {
  const invalidate = useInvalidateEnrollments(schoolId);
  return useMutation({
    mutationFn: async (payload: EnrollmentPayload) =>
      (await api.post(`/schools/${schoolId}/enrollments`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateEnrollmentMutation(schoolId: string) {
  const invalidate = useInvalidateEnrollments(schoolId);
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<EnrollmentPayload>;
    }) =>
      (await api.patch(`/schools/${schoolId}/enrollments/${id}`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useRecordPaymentMutation(schoolId: string) {
  const invalidate = useInvalidateEnrollments(schoolId);
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
        await api.post(`/schools/${schoolId}/enrollments/${id}/payments`, {
          amount,
          paymentMode,
          paymentDate,
        })
      ).data,
    onSuccess: invalidate,
  });
}

export function useDeleteEnrollmentMutation(schoolId: string) {
  const invalidate = useInvalidateEnrollments(schoolId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/schools/${schoolId}/enrollments/${id}`)).data,
    onSuccess: invalidate,
  });
}
