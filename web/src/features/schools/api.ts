import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { School } from "@/types";

// Toute communication avec l'API passe désormais par React Query : les
// `useQuery` gèrent fetch/cache/déduplication/refetch, les `useMutation`
// gèrent les écritures et invalident les queries concernées en cas de
// succès. Fini les `useState`/`useEffect` manuels dans les pages.
export const schoolsKeys = {
  all: ["schools"] as const,
  detail: (schoolId: string) => ["schools", schoolId] as const,
};

export function useSchoolsQuery() {
  return useQuery({
    queryKey: schoolsKeys.all,
    queryFn: async ({ signal }) => (await api.get<School[]>("/schools", { signal })).data,
  });
}

export function useSchoolQuery(schoolId: string | undefined) {
  return useQuery({
    queryKey: schoolsKeys.detail(schoolId ?? ""),
    queryFn: async ({ signal }) => (await api.get<School>(`/schools/${schoolId}`, { signal })).data,
    enabled: Boolean(schoolId),
  });
}

export function useCreateSchoolMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await api.post<School>("/schools", { name })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: schoolsKeys.all });
    },
  });
}

// Modifier les informations d'une école déjà créée — demande explicite :
// "admin et superadmin doivent pouvoir modifier les informations d'une
// école déjà créée". Le backend autorise déjà `PATCH /schools/:schoolId` à
// l'ADMIN de cette école ET au superadmin (`requireSchoolRole` court-
// circuite pour `isSuperAdmin` — voir middleware/auth.ts) ; il ne manquait
// que ce hook côté frontend.
export interface UpdateSchoolInput {
  name?: string;
  director?: string;
  address?: string;
  island?: string;
  phone?: string;
  email?: string;
  arreteNumber?: string;

  currency?: string;
  cycle?: string;
}

export function useUpdateSchoolMutation(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateSchoolInput) =>
      (await api.patch<School>(`/schools/${schoolId}`, payload)).data,
    onSuccess: (school) => {
      queryClient.setQueryData(schoolsKeys.detail(schoolId), school);
      queryClient.invalidateQueries({ queryKey: schoolsKeys.all });
    },
  });
}


export function schoolLogoUrl(schoolId: string): string {
  return `/api/schools/${schoolId}/logo`;
}

function useInvalidateSchool(schoolId: string) {
  const queryClient = useQueryClient();
  return (school?: School) => {
    if (school) queryClient.setQueryData(schoolsKeys.detail(schoolId), school);
    queryClient.invalidateQueries({ queryKey: schoolsKeys.detail(schoolId) });
    queryClient.invalidateQueries({ queryKey: schoolsKeys.all });
  };
}

export function useUploadSchoolLogoMutation(schoolId: string) {
  const invalidate = useInvalidateSchool(schoolId);
  return useMutation({
    mutationFn: async ({
      file,
      onUploadProgress,
    }: {
      file: File;
      onUploadProgress?: (percent: number) => void;
    }) => {
      const formData = new FormData();
      formData.append("logo", file);
      return (
        await api.post<School>(`/schools/${schoolId}/logo`, formData, {
          onUploadProgress: onUploadProgress
            ? (evt) => onUploadProgress(evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0)
            : undefined,
        })
      ).data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSchoolLogoMutation(schoolId: string) {
  const invalidate = useInvalidateSchool(schoolId);
  return useMutation({
    mutationFn: async () => (await api.delete(`/schools/${schoolId}/logo`)).data,
    onSuccess: () => invalidate(),
  });
}
