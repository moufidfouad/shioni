import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { extractErrorMessage } from "./auth";
import { showErrorToast } from "../lib/toast";
import { AttendanceRecord, AttendanceStats, AttendanceStatus, Paginated } from "../types";

// GET /schools/:schoolId/attendance/stats — route WEB existante
// (attendance.routes.ts, requireAnySchoolRole), réutilisée telle quelle.
// `dateFrom`/`dateTo` optionnels (itération 86) : SANS eux, l'historique
// COMPLET de la classe (comportement d'origine, Phase 2b, itération 75) —
// AVEC eux, un sous-ensemble de la période choisie par des raccourcis "7/30/
// 90 derniers jours" (voir attendance.tsx::AttendanceRecap), pas un vrai
// calendrier — aucune librairie de date picker introduite, même choix
// assumé que la Saisie (itération 83, navigation jour par jour uniquement).
export function useAttendanceStatsQuery(
  schoolId: string | undefined,
  groupeId: string | undefined,
  dateFrom?: string,
  dateTo?: string
) {
  return useQuery({
    queryKey: ["attendance", "stats", schoolId, groupeId, dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get<AttendanceStats>(`/schools/${schoolId}/attendance/stats`, {
        params: { groupeId, dateFrom, dateTo },
      });
      return data;
    },
    enabled: Boolean(schoolId) && Boolean(groupeId),
  });
}

// Itération 83 — Phase 2b, saisie de présence (jusqu'ici lecture seule, voir
// commentaire ci-dessus). `all: true` : le registre d'UNE classe pour UN
// jour est par nature borné (même échappatoire que le web, voir
// frontend/src/features/attendance/api.ts::useAttendanceQuery et son
// commentaire) — jamais utilisé pour une liste potentiellement longue
// ailleurs dans l'app mobile (voir students.ts).
export interface AttendanceListFilters {
  groupeId: string | undefined;
  dateFrom: string;
  dateTo: string;
}

export function useAttendanceQuery(schoolId: string | undefined, filters: AttendanceListFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["attendance", "list", schoolId, filters],
    queryFn: async () => {
      const { data } = await api.get<Paginated<AttendanceRecord>>(`/schools/${schoolId}/attendance`, {
        params: { groupeId: filters.groupeId, dateFrom: filters.dateFrom, dateTo: filters.dateTo, all: true },
      });
      return data.data;
    },
    enabled: Boolean(schoolId) && Boolean(filters.groupeId) && enabled,
  });
}

export interface BulkAttendanceRow {
  studentId: string;
  status: AttendanceStatus;
  motif?: string;
  justifiee?: boolean;
}

export interface BulkAttendancePayload {
  groupeId: string;
  date: string;
  records: BulkAttendanceRow[];
}

// POST /schools/:schoolId/attendance/bulk — route WEB existante
// (attendance.routes.ts::canWrite, ADMIN/GESTION_ELEVES/ENSEIGNANT restreint
// à ses propres classes côté serveur via resolveTeacherScope), réutilisée
// telle quelle. Invalidation large (`["attendance"]`) plutôt que ciblée :
// une saisie touche à la fois le récapitulatif (stats) et le registre du
// jour (list), plus simple qu'une invalidation à deux clés précises pour un
// écran qui n'est pas un chemin chaud.
export function useBulkSetAttendanceMutation(schoolId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BulkAttendancePayload) => {
      await api.post(`/schools/${schoolId}/attendance/bulk`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (err) => showErrorToast(extractErrorMessage(err, "Échec de l'enregistrement des présences.")),
  });
}
