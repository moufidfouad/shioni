import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { TeachingScope } from "@/types";

export function useMyTeachingScopeQuery(schoolId: string) {
  return useQuery({
    queryKey: ["me", "teaching-scope", schoolId],
    queryFn: async ({ signal }) =>
      (
        await api.get<TeachingScope>(`/schools/${schoolId}/me/teaching-scope`, {
          signal,
        })
      ).data,
    enabled: Boolean(schoolId),
    staleTime: 5 * 60 * 1000,
  });
}
