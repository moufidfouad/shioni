import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Resource } from "@/types";

export const DOCUMENT_ACCEPT =
  ".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";

export const DOCUMENT_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
]);

export const resourcesKeys = {
  list: (schoolId: string) => ["resources", schoolId] as const,
};

export function useResourcesQuery(schoolId: string) {
  return useQuery({
    queryKey: resourcesKeys.list(schoolId),
    queryFn: async ({ signal }) =>
      (await api.get<Resource[]>(`/schools/${schoolId}/resources`, { signal }))
        .data,
  });
}

function useInvalidateResources(schoolId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: resourcesKeys.list(schoolId) });
}

export interface CreateVideoResourceInput {
  title: string;
  description?: string;
  videoUrl: string;
  subjectIds: string[];
  classeIds: string[];
  published?: boolean;
}

export function useCreateVideoResourceMutation(schoolId: string) {
  const invalidate = useInvalidateResources(schoolId);
  return useMutation({
    mutationFn: async (input: CreateVideoResourceInput) =>
      (await api.post<Resource>(`/schools/${schoolId}/resources/video`, input))
        .data,
    onSuccess: invalidate,
  });
}

export interface CreateDocumentResourceInput {
  title: string;
  description?: string;
  subjectIds: string[];
  classeIds: string[];
  published?: boolean;
  file: File;
  /** Audit §4.4/§6 Should : progression d'upload — pourcentage 0-100, non envoyé au backend. */
  onUploadProgress?: (percent: number) => void;
}

// Même patron que `features/messaging/api.ts::useSendAttachmentMutation` —
// les tableaux d'ids passent en chaîne JSON (multer ne peuple `req.body`
// qu'avec des chaînes, voir resources.schema.ts côté backend).
export function useCreateDocumentResourceMutation(schoolId: string) {
  const invalidate = useInvalidateResources(schoolId);
  return useMutation({
    mutationFn: async ({
      file,
      subjectIds,
      classeIds,
      published,
      onUploadProgress,
      ...rest
    }: CreateDocumentResourceInput) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", rest.title);
      if (rest.description) formData.append("description", rest.description);
      formData.append("subjectIds", JSON.stringify(subjectIds));
      formData.append("classeIds", JSON.stringify(classeIds));
      if (published !== undefined)
        formData.append("published", String(published));
      return (
        await api.post<Resource>(
          `/schools/${schoolId}/resources/document`,
          formData,
          {
            onUploadProgress: onUploadProgress
              ? (evt) =>
                  onUploadProgress(
                    evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0,
                  )
              : undefined,
          },
        )
      ).data;
    },
    onSuccess: invalidate,
  });
}

export interface UpdateResourceInput {
  title?: string;
  description?: string;
  published?: boolean;
  videoUrl?: string;
  subjectIds?: string[];
  classeIds?: string[];
}

export function useUpdateResourceMutation(schoolId: string) {
  const invalidate = useInvalidateResources(schoolId);
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateResourceInput;
    }) =>
      (
        await api.patch<Resource>(
          `/schools/${schoolId}/resources/${id}`,
          payload,
        )
      ).data,
    onSuccess: invalidate,
  });
}

export function useDeleteResourceMutation(schoolId: string) {
  const invalidate = useInvalidateResources(schoolId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/schools/${schoolId}/resources/${id}`)).data,
    onSuccess: invalidate,
  });
}

// Téléchargement authentifié d'un document (même principe que
// `messaging/api.ts::attachmentUrl` — requête same-origin, le cookie de
// session suffit, pas besoin de passer par `api`/axios pour l'afficher).
export function resourceDownloadUrl(
  schoolId: string,
  resourceId: string,
): string {
  return `/api/schools/${schoolId}/resources/${resourceId}/download`;
}
