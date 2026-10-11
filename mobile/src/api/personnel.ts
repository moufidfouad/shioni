import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { extractErrorMessage } from "./auth";
import { LEGACY_API_URL } from "../config";
import { showErrorToast } from "../lib/toast";
import { PickedPhoto } from "../lib/photoPicker";
import { getNextPageParam } from "../lib/pagination";
import { Paginated, StaffMember } from "../types";

// Phase 2d (itération 75) — module Personnel en consultation. Contrairement
// à Élèves, tout ce module backend est réservé à ADMIN (lecture ET
// écriture, voir personnel.routes.ts : `router.use(requireSchoolRole(ADMIN))`
// posé avant TOUTES les routes) — la fiche contient `salaireBrut`, une
// donnée sensible, et aucun rôle `GESTION_PERSONNEL` dédié n'existe. Ces
// hooks échoueraient en 403 pour tout compte non-ADMIN ; l'écran mobile
// (personnel/index.tsx) n'est de toute façon lié depuis le Tableau de bord
// QUE si `school.myRoles` contient `ADMIN` (voir dashboard.tsx) — même
// principe que School.isGuardian/isStudent pour éviter un appel voué à
// échouer. LECTURE SEULE côté mobile, comme Élèves — SEULE EXCEPTION,
// ajoutée à la Phase 3c (itération 80) : l'upload/suppression de la photo
// (voir plus bas), sans vérification cliente supplémentaire ici puisque tout
// le module est déjà ADMIN-only, lecture comprise (aucun rôle intermédiaire
// à distinguer, contrairement à Élèves).

export interface StaffFilters {
  search?: string;
  statut?: string;
}

const STAFF_PAGE_SIZE = 20;

export function useStaffQuery(schoolId: string | undefined, filters: StaffFilters, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["personnel", schoolId, filters],
    queryFn: async ({ pageParam }) =>
      (
        await api.get<Paginated<StaffMember>>(`/schools/${schoolId}/personnel`, {
          params: { ...filters, page: pageParam, pageSize: STAFF_PAGE_SIZE },
        })
      ).data,
    initialPageParam: 1,
    getNextPageParam,
    enabled: Boolean(schoolId) && enabled,
  });
}

export function useStaffMemberQuery(schoolId: string | undefined, staffId: string | undefined) {
  return useQuery({
    queryKey: ["personnel", schoolId, "detail", staffId],
    queryFn: async () => (await api.get<StaffMember>(`/schools/${schoolId}/personnel/${staffId}`)).data,
    enabled: Boolean(schoolId) && Boolean(staffId),
  });
}

// Même raisonnement que students.ts::studentPhotoUrl — URL absolue, header
// Authorization posé explicitement par AuthenticatedPhoto.tsx.
export function staffPhotoUrl(schoolId: string, staffId: string): string {
  return `${LEGACY_API_URL}/schools/${schoolId}/personnel/${staffId}/photo`;
}

// Phase 3c (itération 80) — même patron que students.ts, mêmes commentaires
// de fond (voir ce fichier), non répétés ici.
export function useUploadStaffPhotoMutation(schoolId: string | undefined, staffId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (asset: PickedPhoto) => {
      const form = new FormData();
      form.append("photo", {
        uri: asset.uri,
        name: `photo-${Date.now()}.jpg`,
        type: "image/jpeg",
      } as unknown as Blob);
      const { data } = await api.post<StaffMember>(`/schools/${schoolId}/personnel/${staffId}/photo`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: (staff) => {
      queryClient.setQueryData(["personnel", schoolId, "detail", staffId], staff);
    },
    onError: (err) => showErrorToast(extractErrorMessage(err, "Échec de l'envoi de la photo.")),
  });
}

export function useRemoveStaffPhotoMutation(schoolId: string | undefined, staffId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/schools/${schoolId}/personnel/${staffId}/photo`);
    },
    onSuccess: () => {
      queryClient.setQueryData<StaffMember | undefined>(["personnel", schoolId, "detail", staffId], (prev) =>
        prev ? { ...prev, hasPhoto: false } : prev
      );
    },
    onError: (err) => showErrorToast(extractErrorMessage(err, "Échec de la suppression de la photo.")),
  });
}
