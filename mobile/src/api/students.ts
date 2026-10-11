import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { extractErrorMessage } from "./auth";
import { LEGACY_API_URL } from "../config";
import { showErrorToast } from "../lib/toast";
import { PickedPhoto } from "../lib/photoPicker";
import { getNextPageParam } from "../lib/pagination";
import { Paginated, Student } from "../types";

// Phase 2d (itération 75) — module Élèves en consultation, PERSONNEL
// uniquement (`requireAnySchoolRole` côté backend, portée Enseignant
// résolue par `resolveTeacherScope` — un compte ENSEIGNANT ne reçoit ici que
// SES classes, sans qu'aucune logique de portée ne soit dupliquée côté
// mobile). LECTURE SEULE : création/modification/suppression de fiche élève
// restent réservées au web pour l'instant (`canManage`, ADMIN/
// GESTION_ELEVES), même choix que Notes/Présences/Emploi du temps. SEULE
// EXCEPTION, ajoutée à la Phase 3c (itération 80) : l'upload/suppression de
// la photo (`useUploadStudentPhotoMutation`/`useRemoveStudentPhotoMutation`
// plus bas), affichée uniquement si `school.myRoles` contient ADMIN ou
// GESTION_ELEVES (voir students/[studentId].tsx) — mêmes rôles que
// `canManage` côté backend (students.routes.ts), vérifiés ici côté client
// UNIQUEMENT pour éviter d'afficher un contrôle voué à un 403 : le serveur
// reste la seule source de vérité RBAC, cette vérification cliente n'est
// qu'un confort d'affichage.

export interface StudentFilters {
  search?: string;
  groupeId?: string;
  // Itération 88 — parité avec le filtre "sexe" de StudentsPage.tsx (web) :
  // l'endpoint `GET /students` l'accepte déjà depuis toujours
  // (students.schema.ts), seul le mobile ne l'envoyait pas encore. Contraste
  // volontaire avec `useClassRosterQuery` ci-dessous (roster COMPLET d'une
  // classe, jamais filtré par sexe — un registre de présence/notes a besoin
  // de TOUS les élèves de la classe).
  sex?: "M" | "F";
}

const STUDENTS_PAGE_SIZE = 20;

// Contrat de pagination page/pageSize PARTAGÉ (voir Paginated<T>,
// src/types/index.ts) — PREMIÈRE utilisation mobile de ce contrat,
// consommé via `useInfiniteQuery` exactement comme recommandé par le plan
// mobile (section 2.3) : `getNextPageParam` avance tant que
// `page < totalPages`. `all=true` n'est JAMAIS utilisé ici (échappatoire
// réservée aux sélecteurs internes du web, voir utils/pagination.ts) — une
// liste d'élèves peut être longue, charger une page à la fois sur un réseau
// mobile plutôt que la table entière.
export function useStudentsQuery(schoolId: string | undefined, filters: StudentFilters) {
  return useInfiniteQuery({
    queryKey: ["students", schoolId, filters],
    queryFn: async ({ pageParam }) =>
      (
        await api.get<Paginated<Student>>(`/schools/${schoolId}/students`, {
          params: { ...filters, page: pageParam, pageSize: STUDENTS_PAGE_SIZE },
        })
      ).data,
    initialPageParam: 1,
    getNextPageParam,
    enabled: Boolean(schoolId),
  });
}

// Itération 83 — roster COMPLET d'UNE classe, `all: true` (échappatoire
// documentée par utils/pagination.ts, déjà utilisée côté web pour ce même
// besoin — voir frontend/src/pages/school/AttendancePage.tsx::AttendanceEntry).
// Réservé aux écrans de SAISIE qui ont besoin de TOUS les élèves d'une
// classe d'un coup (présences — attendance.tsx ; potentiellement notes plus
// tard) : contrairement à `useStudentsQuery` ci-dessus (liste paginée de
// l'école entière, jamais `all=true`, voir son commentaire), un roster de
// classe est par nature borné à la taille d'une classe.
export function useClassRosterQuery(schoolId: string | undefined, groupeId: string | undefined) {
  return useQuery({
    queryKey: ["students", schoolId, "roster", groupeId],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Student>>(`/schools/${schoolId}/students`, {
        params: { groupeId, all: true },
      });
      return data.data;
    },
    enabled: Boolean(schoolId) && Boolean(groupeId),
  });
}

export function useStudentQuery(schoolId: string | undefined, studentId: string | undefined) {
  return useQuery({
    queryKey: ["students", schoolId, "detail", studentId],
    queryFn: async () => (await api.get<Student>(`/schools/${schoolId}/students/${studentId}`)).data,
    enabled: Boolean(schoolId) && Boolean(studentId),
  });
}

// Itération 64 (web) — photo d'identité élève, route protégée (JAMAIS un
// fichier `express.static`, voir students.service.ts) : contrairement au
// web (`<img src="/api/schools/.../photo">`, cookie envoyé automatiquement
// par le navigateur), le mobile n'a pas de cookie — l'URL seule ne suffit
// pas, un en-tête `Authorization: Bearer` explicite doit accompagner la
// requête `<Image>` elle-même (voir src/components/AuthenticatedPhoto.tsx,
// qui consomme cette URL avec ce header). URL absolue (LEGACY_API_URL, base
// SANS /v1, mêmes routes métier que le reste de l'API mobile) — un
// `<Image source={{ uri }}>` ne passe pas par l'instance axios `api`, donc
// pas par son `baseURL` relatif.
export function studentPhotoUrl(schoolId: string, studentId: string): string {
  return `${LEGACY_API_URL}/schools/${schoolId}/students/${studentId}/photo`;
}

// Phase 3c (itération 80) — mêmes endpoints que l'exemple d'upload déjà
// documenté par le plan mobile (section 3.5), aucune adaptation backend :
// `multer` reçoit le même `multipart/form-data` qu'un `File` web, construit
// ici depuis `{ uri, name, type }` (RN n'a pas de `Blob`/`File` du DOM). La
// réponse (`Student` à jour, `hasPhoto: true`) est pausée directement en
// cache plutôt qu'une invalidation — évite un aller-retour réseau superflu
// juste après l'upload.
export function useUploadStudentPhotoMutation(schoolId: string | undefined, studentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (asset: PickedPhoto) => {
      const form = new FormData();
      form.append("photo", {
        uri: asset.uri,
        name: `photo-${Date.now()}.jpg`,
        type: "image/jpeg",
      } as unknown as Blob);
      const { data } = await api.post<Student>(`/schools/${schoolId}/students/${studentId}/photo`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: (student) => {
      queryClient.setQueryData(["students", schoolId, "detail", studentId], student);
    },
    onError: (err) => showErrorToast(extractErrorMessage(err, "Échec de l'envoi de la photo.")),
  });
}

export function useRemoveStudentPhotoMutation(schoolId: string | undefined, studentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/schools/${schoolId}/students/${studentId}/photo`);
    },
    onSuccess: () => {
      queryClient.setQueryData<Student | undefined>(["students", schoolId, "detail", studentId], (prev) =>
        prev ? { ...prev, hasPhoto: false } : prev
      );
    },
    onError: (err) => showErrorToast(extractErrorMessage(err, "Échec de la suppression de la photo.")),
  });
}
