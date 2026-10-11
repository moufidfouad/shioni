import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { DashboardData } from "@/types";


export function useDashboardQuery(schoolId: string, schoolYearId?: string, enabled = true) {
  return useQuery({
    queryKey: ["dashboard", schoolId, schoolYearId],
    queryFn: async ({ signal }) =>
      (
        await api.get<DashboardData>(`/schools/${schoolId}/dashboard`, {
          params: { schoolYearId: schoolYearId || undefined },
          signal,
        })
      ).data,
    enabled: enabled && Boolean(schoolId),
  });
}
