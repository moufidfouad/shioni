import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import {
  Paginated,
  PublicResource,
  PublicResourceFilterOptions,
  PublicResourcesFilters,
} from "@/types";

export const publicResourcesKeys = {
  list: (filters: PublicResourcesFilters, page: number) =>
    ["public-resources", filters, page] as const,
  filters: () => ["public-resources", "filters"] as const,
  detail: (id: string) => ["public-resources", "detail", id] as const,
};

function serializeFilters(filters: PublicResourcesFilters) {
  return {
    schoolIds: filters.schoolIds?.length
      ? filters.schoolIds.join(",")
      : undefined,
    classeIds: filters.classeIds?.length
      ? filters.classeIds.join(",")
      : undefined,
    serieIds: filters.serieIds?.length ? filters.serieIds.join(",") : undefined,
    cycleIds: filters.cycleIds?.length ? filters.cycleIds.join(",") : undefined,
    subjectIds: filters.subjectIds?.length
      ? filters.subjectIds.join(",")
      : undefined,
    types: filters.types?.length ? filters.types.join(",") : undefined,
  };
}

export function usePublicResourcesQuery(
  filters: PublicResourcesFilters,
  page = 1,
  pageSize = 12,
) {
  return useQuery({
    queryKey: publicResourcesKeys.list(filters, page),
    queryFn: async ({ signal }) =>
      (
        await api.get<Paginated<PublicResource>>("/public/resources", {
          params: { ...serializeFilters(filters), page, pageSize },
          signal,
        })
      ).data,
  });
}

export function usePublicResourceFiltersQuery() {
  return useQuery({
    queryKey: publicResourcesKeys.filters(),
    queryFn: async ({ signal }) =>
      (
        await api.get<PublicResourceFilterOptions>(
          "/public/resources/filters",
          { signal },
        )
      ).data,
    // Structure pédagogique — change rarement, même raisonnement que
    // `useContactsQuery` côté messagerie.
    staleTime: 60_000,
  });
}

export function usePublicResourceQuery(resourceId: string | null) {
  return useQuery({
    queryKey: publicResourcesKeys.detail(resourceId ?? ""),
    queryFn: async ({ signal }) =>
      (
        await api.get<PublicResource>(`/public/resources/${resourceId}`, {
          signal,
        })
      ).data,
    enabled: Boolean(resourceId),
  });
}

// Construit l'URL de téléchargement d'un document public — pas besoin de
// passer par `api` (axios) pour l'afficher, une simple balise `<a>` suffit
// (aucune authentification requise, contrairement à
// `messaging/api.ts::attachmentUrl`).
export function publicResourceDownloadUrl(resourceId: string): string {
  return `/api/public/resources/${resourceId}/download`;
}
