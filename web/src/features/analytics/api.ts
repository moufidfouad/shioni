import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { AnalyticsOverview } from "@/types";

export function useAnalyticsQuery(schoolId: string, enabled = true) {
  return useQuery({
    queryKey: ["analytics", schoolId],
    queryFn: async ({ signal }) => (await api.get<AnalyticsOverview>(`/schools/${schoolId}/analytics`, { signal })).data,
    enabled: enabled && Boolean(schoolId),
  });
}
