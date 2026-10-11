import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import {
  FinanceEntry,
  FinanceEntryType,
  FinanceMonthlyPoint,
  FinanceStats,
  Paginated,
} from "@/types";

// Filtres de la liste — même patron que les autres fichiers `queries/` :
// tout envoyé au serveur et intégré à la query key.
export interface FinanceFilters {
  year?: number;
  month?: number;
  type?: FinanceEntryType | "";
}

// Correctif audit (pagination serveur) — voir students.ts::PageParams.
export interface PageParams {
  page?: number;
  pageSize?: number;
}

export const financesKeys = {
  all: (schoolId: string) => ["finances", schoolId] as const,
  list: (schoolId: string, filters: FinanceFilters, page: PageParams) =>
    ["finances", schoolId, "list", filters, page] as const,
  stats: (schoolId: string, year?: number, month?: number) =>
    ["finances", schoolId, "stats", year, month] as const,
  monthly: (schoolId: string, year: number) =>
    ["finances", schoolId, "monthly", year] as const,
};

export function useFinanceEntriesQuery(
  schoolId: string,
  filters: FinanceFilters = {},
  page: PageParams = {},
) {
  return useQuery({
    queryKey: financesKeys.list(schoolId, filters, page),
    queryFn: async ({ signal }) =>
      (
        await api.get<Paginated<FinanceEntry>>(
          `/schools/${schoolId}/finances`,
          {
            params: {
              year: filters.year || undefined,
              month: filters.month || undefined,
              type: filters.type || undefined,
              page: page.page,
              pageSize: page.pageSize,
            },
            signal,
          },
        )
      ).data,
  });
}

export function useFinanceStatsQuery(
  schoolId: string,
  year?: number,
  month?: number,
) {
  return useQuery({
    queryKey: financesKeys.stats(schoolId, year, month),
    queryFn: async ({ signal }) =>
      (
        await api.get<FinanceStats>(`/schools/${schoolId}/finances/stats`, {
          params: { year: year || undefined, month: month || undefined },
          signal,
        })
      ).data,
  });
}

export function useFinanceMonthlyQuery(schoolId: string, year: number) {
  return useQuery({
    queryKey: financesKeys.monthly(schoolId, year),
    queryFn: async ({ signal }) =>
      (
        await api.get<FinanceMonthlyPoint[]>(
          `/schools/${schoolId}/finances/monthly`,
          { params: { year }, signal },
        )
      ).data,
  });
}

function useInvalidateFinances(schoolId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: financesKeys.all(schoolId) });
}

export function useCreateFinanceEntryMutation(schoolId: string) {
  const invalidate = useInvalidateFinances(schoolId);
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.post<FinanceEntry>(`/schools/${schoolId}/finances`, payload))
        .data,
    onSuccess: invalidate,
  });
}

export function useUpdateFinanceEntryMutation(schoolId: string) {
  const invalidate = useInvalidateFinances(schoolId);
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) =>
      (
        await api.patch<FinanceEntry>(
          `/schools/${schoolId}/finances/${id}`,
          payload,
        )
      ).data,
    onSuccess: invalidate,
  });
}

export function useDeleteFinanceEntryMutation(schoolId: string) {
  const invalidate = useInvalidateFinances(schoolId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/schools/${schoolId}/finances/${id}`)).data,
    onSuccess: invalidate,
  });
}
