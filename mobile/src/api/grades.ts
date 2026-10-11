import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { extractErrorMessage } from "./auth";
import { showErrorToast } from "../lib/toast";
import { Bulletin, Grade, Paginated, RankingRow } from "../types";

// GET /schools/:schoolId/grades/ranking et .../bulletin/:studentId — routes
// WEB existantes (grades.routes.ts), réutilisées telles quelles. Lecture
// seule pour cette Phase 2a (voir la note de scope dans notes.tsx) : la
// saisie de notes (POST/PATCH, restreinte par resolveTeacherScope côté
// backend) reste hors périmètre pour l'instant.
export function useRankingQuery(schoolId: string | undefined, groupeId: string | undefined, trimestre: number) {
  return useQuery({
    queryKey: ["grades", "ranking", schoolId, groupeId, trimestre],
    queryFn: async () => {
      const { data } = await api.get<RankingRow[]>(`/schools/${schoolId}/grades/ranking`, {
        params: { groupeId, trimestre },
      });
      return data;
    },
    enabled: Boolean(schoolId) && Boolean(groupeId) && Boolean(trimestre),
  });
}

export function useBulletinQuery(schoolId: string | undefined, studentId: string | undefined, trimestre: number) {
  return useQuery({
    queryKey: ["grades", "bulletin", schoolId, studentId, trimestre],
    queryFn: async () => {
      const { data } = await api.get<Bulletin>(`/schools/${schoolId}/grades/bulletin/${studentId}`, {
        params: { trimestre },
      });
      return data;
    },
    enabled: Boolean(schoolId) && Boolean(studentId) && Boolean(trimestre),
  });
}

// Itération 83 — saisie de notes (jusqu'ici lecture seule, voir commentaire
// ci-dessus). `all: true` : classement/registre borné à UNE classe + UNE
// matière + UN trimestre, même échappatoire que le web (voir
// frontend/src/features/grades/api.ts::useGradesQuery) et que Présences
// (itération 83, api/attendance.ts) — jamais utilisée pour une liste
// potentiellement longue ailleurs sur mobile.
export interface GradesListFilters {
  groupeId: string | undefined;
  subjectId: string | undefined;
  trimestre: number;
}

export function useGradesQuery(schoolId: string | undefined, filters: GradesListFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["grades", "list", schoolId, filters],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Grade>>(`/schools/${schoolId}/grades`, {
        params: {
          groupeId: filters.groupeId,
          subjectId: filters.subjectId,
          trimestre: filters.trimestre,
          all: true,
        },
      });
      return data.data;
    },
    enabled: Boolean(schoolId) && Boolean(filters.groupeId) && Boolean(filters.subjectId) && enabled,
  });
}

export interface BulkGradeEvaluationEntry {
  studentId: string;
  value: number | null;
}

export interface BulkGradeEvaluationPayload {
  groupeId: string;
  subjectId: string;
  trimestre: number;
  label: string;
  weight: number;
  entries: BulkGradeEvaluationEntry[];
}

// POST /schools/:schoolId/grades/bulk — route WEB existante
// (grades.routes.ts::canWrite, ADMIN/GESTION_NOTES/ENSEIGNANT restreint à
// ses propres classes/matières côté serveur via resolveTeacherScope),
// réutilisée telle quelle. Une évaluation (libellé + poids communs) pour
// TOUTE une classe d'un coup, une valeur par élève — rejouer avec le même
// libellé MET À JOUR l'évaluation existante plutôt que d'en créer une
// doublon (voir grades.service.ts::bulkSetGradeEvaluation). Invalidation
// large (`["grades"]`) : une saisie touche à la fois le classement, le
// bulletin de chaque élève concerné et le registre de saisie lui-même.
export function useBulkSetGradeEvaluationMutation(schoolId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BulkGradeEvaluationPayload) => {
      await api.post(`/schools/${schoolId}/grades/bulk`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
    },
    onError: (err) => showErrorToast(extractErrorMessage(err, "Échec de l'enregistrement des notes.")),
  });
}
