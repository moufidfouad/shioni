import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { MyStudentSummary } from "@/types";


export function useMyStudentSummaryQuery(schoolId: string, trimestre?: number) {
  return useQuery({
    queryKey: ["student-portal", "my-summary", schoolId, trimestre],
    queryFn: async ({ signal }) =>
      (
        await api.get<MyStudentSummary>(`/schools/${schoolId}/student/me/summary`, {
          params: { trimestre: trimestre || undefined },
          signal,
        })
      ).data,
    enabled: Boolean(schoolId),
  });
}
