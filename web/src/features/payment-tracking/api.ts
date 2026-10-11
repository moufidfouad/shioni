import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Paginated, PaymentTrackingRow, PaymentTrackingStats } from "@/types";


export interface PaymentTrackingFilters {

  schoolYearId: string;
  groupeId?: string;
  search?: string;
}

export interface PageParams {
  page?: number;
  pageSize?: number;
}

export const paymentTrackingKeys = {
  list: (schoolId: string, filters: PaymentTrackingFilters, page: PageParams) =>
    ["payment-tracking", schoolId, "list", filters, page] as const,
  stats: (schoolId: string, filters: Pick<PaymentTrackingFilters, "schoolYearId" | "groupeId">) =>
    ["payment-tracking", schoolId, "stats", filters] as const,
};

export function usePaymentTrackingQuery(schoolId: string, filters: PaymentTrackingFilters, page: PageParams = {}) {
  return useQuery({
    queryKey: paymentTrackingKeys.list(schoolId, filters, page),
    // `enabled` : `schoolYearId` est obligatoire côté backend (zod), inutile
    // de partir en requête (et en 400 garanti) tant qu'il est vide.
    enabled: Boolean(filters.schoolYearId),
    queryFn: async ({ signal }) =>
      (
        await api.get<Paginated<PaymentTrackingRow>>(`/schools/${schoolId}/payment-tracking`, {
          params: {
            schoolYearId: filters.schoolYearId,
            groupeId: filters.groupeId || undefined,
            search: filters.search || undefined,
            page: page.page,
            pageSize: page.pageSize,
          },
          signal,
        })
      ).data,
  });
}

export function usePaymentTrackingStatsQuery(schoolId: string, filters: Pick<PaymentTrackingFilters, "schoolYearId" | "groupeId">) {
  return useQuery({
    queryKey: paymentTrackingKeys.stats(schoolId, filters),
    enabled: Boolean(filters.schoolYearId),
    queryFn: async ({ signal }) =>
      (
        await api.get<PaymentTrackingStats>(`/schools/${schoolId}/payment-tracking/stats`, {
          params: { schoolYearId: filters.schoolYearId, groupeId: filters.groupeId || undefined },
          signal,
        })
      ).data,
  });
}
