import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { ChildSummary, GuardianChild } from "@/types";


export function useMyChildrenQuery(schoolId: string) {
  return useQuery({
    queryKey: ["parent-portal", "children", schoolId],
    queryFn: async ({ signal }) => (await api.get<GuardianChild[]>(`/schools/${schoolId}/parent/children`, { signal })).data,
    enabled: Boolean(schoolId),
  });
}

export function useChildSummaryQuery(schoolId: string, studentId: string, trimestre?: number) {
  return useQuery({
    queryKey: ["parent-portal", "child-summary", schoolId, studentId, trimestre],
    queryFn: async ({ signal }) =>
      (
        await api.get<ChildSummary>(`/schools/${schoolId}/parent/children/${studentId}/summary`, {
          params: { trimestre: trimestre || undefined },
          signal,
        })
      ).data,
    enabled: Boolean(schoolId) && Boolean(studentId),
  });
}
