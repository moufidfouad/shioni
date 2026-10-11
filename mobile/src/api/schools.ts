import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { extractErrorMessage } from "./auth";
import { LEGACY_API_URL } from "../config";
import { showErrorToast } from "../lib/toast";
import { PickedPhoto } from "../lib/photoPicker";
import { School } from "../types";

// GET /schools — route WEB existante (schools.routes.ts), réutilisée telle
// quelle (voir plan mobile, section 1.1) : liste MES écoles (toutes si
// superadmin), tableau simple, PAS paginée (contrairement à /students,
// /grades... — voir schools.service.ts::listSchoolsForUser).
export function useSchoolsQuery() {
  return useQuery({
    queryKey: ["schools"],
    queryFn: async () => {
      const { data } = await api.get<School[]>("/schools");
      return data;
    },
  });
}

// GET /schools/:schoolId — détail d'une école, accessible à tout membre du
// personnel OU un Parent/Élève lié (requireSchoolMemberOrGuardian, voir
// middleware/auth.ts) : sert de premier écran "à l'intérieur" d'une école,
// pour vérifier de bout en bout qu'une route paramétrée protégée répond
// bien à un appel Bearer mobile.
export function useSchoolQuery(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["schools", schoolId],
    queryFn: async () => {
      const { data } = await api.get<School>(`/schools/${schoolId}`);
      return data;
    },
    enabled: Boolean(schoolId),
  });
}

// Itération 89 — logo d'école (Phase 3c, dernier upload photo/fichier
// listé comme manquant côté mobile, `students.ts`/`personnel.ts` couvrant
// déjà élèves et personnel depuis l'itération 80). Même patron que
// `studentPhotoUrl` (students.ts) : route protégée
// (`requireSchoolMemberOrGuardian`, jamais `express.static`), pas de
// cookie côté mobile — l'URL seule ne suffit pas, un en-tête
// `Authorization: Bearer` explicite doit accompagner la requête `<Image>`
// (voir AuthenticatedPhoto.tsx, qui consomme cette URL avec ce header).
export function schoolLogoUrl(schoolId: string): string {
  return `${LEGACY_API_URL}/schools/${schoolId}/logo`;
}

// POST/DELETE /schools/:schoolId/logo — routes WEB existantes
// (schools.routes.ts, ADMIN uniquement dans les deux sens), réutilisées
// telles quelles. Réponse = l'école à jour (`uploadLogo` renvoie `school`,
// pas juste `{hasLogo}`) — posée directement en cache plutôt qu'une
// invalidation, même choix que `useUploadStudentPhotoMutation`.
export function useUploadSchoolLogoMutation(schoolId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (asset: PickedPhoto) => {
      const form = new FormData();
      form.append("logo", {
        uri: asset.uri,
        name: `logo-${Date.now()}.jpg`,
        type: "image/jpeg",
      } as unknown as Blob);
      const { data } = await api.post<School>(`/schools/${schoolId}/logo`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: (school) => {
      queryClient.setQueryData(["schools", schoolId], school);
    },
    onError: (err) => showErrorToast(extractErrorMessage(err, "Échec de l'envoi du logo.")),
  });
}

export function useRemoveSchoolLogoMutation(schoolId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/schools/${schoolId}/logo`);
    },
    onSuccess: () => {
      queryClient.setQueryData<School | undefined>(["schools", schoolId], (prev) =>
        prev ? { ...prev, hasLogo: false } : prev
      );
    },
    onError: (err) => showErrorToast(extractErrorMessage(err, "Échec de la suppression du logo.")),
  });
}
