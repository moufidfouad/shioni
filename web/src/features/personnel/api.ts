import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Paginated, StaffMember, StaffStats } from "@/types";

// Filtres de la liste du personnel — même patron que `students.ts` (search
// débattue côté page, tout envoyé au serveur et intégré à la query key).
export interface StaffFilters {
  search?: string;
  fonction?: string;
  statut?: string;
}

// Correctif audit (pagination serveur) — `page`/`pageSize` composent avec
// `StaffFilters` ci-dessus. `all: true` : échappatoire backend (voir
// utils/pagination.ts) pour les sélecteurs "enseignant" alimentés par cette
// liste (Subjects.tsx, SchoolMembers.tsx, Timetable.tsx) qui ont besoin de
// TOUT le personnel plutôt que d'une page — seule PersonnelPage.tsx (la page
// de gestion elle-même) utilise `page`/`pageSize` pour de vrai.
export interface PageParams {
  page?: number;
  pageSize?: number;
  all?: boolean;
}

export const personnelKeys = {
  all: (schoolId: string) => ["personnel", schoolId] as const,
  list: (schoolId: string, filters: StaffFilters, page: PageParams) =>
    ["personnel", schoolId, "list", filters, page] as const,
  stats: (schoolId: string) => ["personnel", schoolId, "stats"] as const,
};

export function useStaffQuery(schoolId: string, filters: StaffFilters = {}, page: PageParams = {}) {
  return useQuery({
    queryKey: personnelKeys.list(schoolId, filters, page),
    queryFn: async ({ signal }) =>
      (
        await api.get<Paginated<StaffMember>>(`/schools/${schoolId}/personnel`, {
          params: {
            search: filters.search || undefined,
            fonction: filters.fonction || undefined,
            statut: filters.statut || undefined,
            page: page.page,
            pageSize: page.pageSize,
            all: page.all || undefined,
          },
          signal,
        })
      ).data,
  });
}

export function useStaffStatsQuery(schoolId: string) {
  return useQuery({
    queryKey: personnelKeys.stats(schoolId),
    queryFn: async ({ signal }) => (await api.get<StaffStats>(`/schools/${schoolId}/personnel/stats`, { signal })).data,
  });
}

function useInvalidatePersonnel(schoolId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: personnelKeys.all(schoolId) });
}

export function useCreateStaffMutation(schoolId: string) {
  const invalidate = useInvalidatePersonnel(schoolId);
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.post<StaffMember>(`/schools/${schoolId}/personnel`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateStaffMutation(schoolId: string) {
  const invalidate = useInvalidatePersonnel(schoolId);
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      (await api.patch<StaffMember>(`/schools/${schoolId}/personnel/${id}`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteStaffMutation(schoolId: string) {
  const invalidate = useInvalidatePersonnel(schoolId);
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/schools/${schoolId}/personnel/${id}`)).data,
    onSuccess: invalidate,
  });
}


export function staffPhotoUrl(schoolId: string, staffId: string): string {
  return `/api/schools/${schoolId}/personnel/${staffId}/photo`;
}

export function useUploadStaffPhotoMutation(schoolId: string) {
  const invalidate = useInvalidatePersonnel(schoolId);
  return useMutation({
    mutationFn: async ({
      staffId,
      file,
      onUploadProgress,
    }: {
      staffId: string;
      file: File;
      onUploadProgress?: (percent: number) => void;
    }) => {
      const formData = new FormData();
      formData.append("photo", file);
      return (
        await api.post(`/schools/${schoolId}/personnel/${staffId}/photo`, formData, {
          onUploadProgress: onUploadProgress
            ? (evt) => onUploadProgress(evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0)
            : undefined,
        })
      ).data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteStaffPhotoMutation(schoolId: string) {
  const invalidate = useInvalidatePersonnel(schoolId);
  return useMutation({
    mutationFn: async (staffId: string) => (await api.delete(`/schools/${schoolId}/personnel/${staffId}/photo`)).data,
    onSuccess: invalidate,
  });
}
