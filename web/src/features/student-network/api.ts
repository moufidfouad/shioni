import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { StudentNetworkSearchResult } from "@/types";


export type StudentNetworkSearchField = "nationalIdNumber" | "ministryStudentNumber";

export interface StudentNetworkSearchParams {
  field: StudentNetworkSearchField;
  value: string;
}

export const studentNetworkKeys = {
  search: (schoolId: string, params: StudentNetworkSearchParams | null) =>
    ["student-network", schoolId, "search", params] as const,
};

// `enabled` : contrôlé par l'appelant (déclenché seulement au clic sur
// "Rechercher", jamais à chaque frappe — une seule valeur à la fois, voir le
// schéma backend `studentNetworkSearchSchema` qui refuse les deux champs à
// la fois ou aucun).
export function useStudentNetworkSearchQuery(schoolId: string, params: StudentNetworkSearchParams | null) {
  return useQuery({
    queryKey: studentNetworkKeys.search(schoolId, params),
    queryFn: async ({ signal }) =>
      (
        await api.get<StudentNetworkSearchResult>(`/schools/${schoolId}/student-network/search`, {
          params: { [params!.field]: params!.value },
          signal,
        })
      ).data,
    enabled: Boolean(params && params.value.trim()),
  });
}
