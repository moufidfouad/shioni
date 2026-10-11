import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Paginated, Student, StudentStats } from "../../types";
import { schoolsKeys } from "../schools/api";

// Filtres de la liste des élèves. `search` (nom) et `groupeId` étaient déjà
// supportés côté API (`students.service.ts`) ; `sex` a été ajouté côté
// backend pour cette itération (même patron `where` que `groupeId`). Tous
// les trois sont envoyés au serveur (`GET /students?search=&groupeId=&sex=`)
// plutôt que filtrés côté client : la liste peut être longue, et c'est déjà
// le patron existant pour `search`/`groupeId`.
export interface StudentFilters {
  search?: string;
  groupeId?: string;
  sex?: "M" | "F";
}

// Correctif audit (pagination serveur) — `page`/`pageSize` séparés des
// filtres ci-dessus (plutôt que fusionnés dedans) : ils composent avec
// n'importe quel filtre, et changer de page seul n'a pas besoin de retoucher
// `StudentFilters`. Défauts alignés sur le contrat backend (utils/pagination.ts).
//
// `all: true` : échappatoire côté backend (voir utils/pagination.ts) pour
// les consommateurs qui ont besoin de TOUS les élèves plutôt que d'une page
// — le sélecteur "élève" d'Enrollments.tsx/SchoolMembers.tsx, ou le
// registre d'une classe (Attendance.tsx/Grades.tsx, borné par la taille
// d'une classe, jamais par celle de l'école) — plutôt que de tronquer
// silencieusement ces listes à `pageSize` une fois la pagination serveur en
// place pour la page de gestion (StudentsPage.tsx, la seule à utiliser
// `page`/`pageSize` pour de vrai).
export interface PageParams {
  page?: number;
  pageSize?: number;
  all?: boolean;
}

export const studentsKeys = {
  all: (schoolId: string) => ["students", schoolId] as const,
  list: (schoolId: string, filters: StudentFilters, page: PageParams) =>
    ["students", schoolId, "list", filters, page] as const,
  stats: (schoolId: string) => ["students", schoolId, "stats"] as const,
};


export function useStudentsQuery(schoolId: string, filters: StudentFilters, page: PageParams = {}, enabled = true) {
  return useQuery({
    queryKey: studentsKeys.list(schoolId, filters, page),
    queryFn: async ({ signal }) =>
      (
        await api.get<Paginated<Student>>(`/schools/${schoolId}/students`, {
          params: {
            search: filters.search || undefined,
            groupeId: filters.groupeId || undefined,
            sex: filters.sex || undefined,
            page: page.page,
            pageSize: page.pageSize,
            all: page.all || undefined,
          },
          signal,
        })
      ).data,
    enabled,
  });
}


export function useStudentStatsQuery(schoolId: string, enabled = true) {
  return useQuery({
    queryKey: studentsKeys.stats(schoolId),
    queryFn: async ({ signal }) => (await api.get<StudentStats>(`/schools/${schoolId}/students/stats`, { signal })).data,
    enabled,
  });
}

function useInvalidateStudents(schoolId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: studentsKeys.all(schoolId) });
    // Le nombre d'élèves affiché sur la grille d'écoles (`_count.students`)
    // dépend aussi de cette mutation.
    queryClient.invalidateQueries({ queryKey: schoolsKeys.all });
  };
}

export function useCreateStudentMutation(schoolId: string) {
  const invalidate = useInvalidateStudents(schoolId);
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await api.post(`/schools/${schoolId}/students`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateStudentMutation(schoolId: string) {
  const invalidate = useInvalidateStudents(schoolId);
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      (await api.patch(`/schools/${schoolId}/students/${id}`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteStudentMutation(schoolId: string) {
  const invalidate = useInvalidateStudents(schoolId);
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/schools/${schoolId}/students/${id}`)).data,
    onSuccess: invalidate,
  });
}


export function studentPhotoUrl(schoolId: string, studentId: string): string {
  return `/api/schools/${schoolId}/students/${studentId}/photo`;
}

export function useUploadStudentPhotoMutation(schoolId: string) {
  const invalidate = useInvalidateStudents(schoolId);
  return useMutation({
    mutationFn: async ({
      studentId,
      file,
      onUploadProgress,
    }: {
      studentId: string;
      file: File;
      onUploadProgress?: (percent: number) => void;
    }) => {
      const formData = new FormData();
      formData.append("photo", file);
      return (
        await api.post(`/schools/${schoolId}/students/${studentId}/photo`, formData, {
          onUploadProgress: onUploadProgress
            ? (evt) => onUploadProgress(evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0)
            : undefined,
        })
      ).data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteStudentPhotoMutation(schoolId: string) {
  const invalidate = useInvalidateStudents(schoolId);
  return useMutation({
    mutationFn: async (studentId: string) => (await api.delete(`/schools/${schoolId}/students/${studentId}/photo`)).data,
    onSuccess: invalidate,
  });
}
