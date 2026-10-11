import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import {
  EndOfYearDecisionType,
  EndOfYearOverviewRow,
  EndOfYearStats,
} from "@/types";
import { studentsKeys } from "../students/api";

export const endOfYearKeys = {
  all: (schoolId: string) => ["end-of-year", schoolId] as const,
  overview: (schoolId: string, groupeId?: string, schoolYearId?: string) =>
    ["end-of-year", schoolId, "overview", groupeId, schoolYearId] as const,
  stats: (schoolId: string, schoolYearId?: string, groupeId?: string) =>
    ["end-of-year", schoolId, "stats", schoolYearId, groupeId] as const,
};

export function useEndOfYearOverviewQuery(
  schoolId: string,
  groupeId?: string,
  schoolYearId?: string,
) {
  return useQuery({
    queryKey: endOfYearKeys.overview(schoolId, groupeId, schoolYearId),
    queryFn: async ({ signal }) =>
      (
        await api.get<EndOfYearOverviewRow[]>(
          `/schools/${schoolId}/end-of-year/overview`,
          {
            params: { groupeId, schoolYearId },
            signal,
          },
        )
      ).data,
    // Chargée seulement une fois classe ET année scolaire choisies — même
    // patron que les vues "Bulletins & classement"/"Récapitulatif" des
    // pages Notes/Présences (un sélecteur de classe obligatoire avant tout
    // appel réseau).
    enabled: Boolean(groupeId && schoolYearId),
  });
}

export function useEndOfYearStatsQuery(
  schoolId: string,
  schoolYearId?: string,
  groupeId?: string,
) {
  return useQuery({
    queryKey: endOfYearKeys.stats(schoolId, schoolYearId, groupeId),
    queryFn: async ({ signal }) =>
      (
        await api.get<EndOfYearStats>(
          `/schools/${schoolId}/end-of-year/stats`,
          {
            params: { schoolYearId, groupeId: groupeId || undefined },
            signal,
          },
        )
      ).data,
    enabled: Boolean(schoolYearId),
  });
}

function useInvalidateEndOfYear(schoolId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: endOfYearKeys.all(schoolId) });
    // Une décision PASSAGE/REORIENTATION/REDOUBLEMENT (avec destination
    // explicite) déplace réellement l'élève vers un autre groupe (effet
    // immédiat, voir end-of-year.service.ts::resolveGroupeEffect côté
    // backend) — la liste Élèves (et tout ce qui en dépend : effectifs par
    // classe, etc.) doit refléter ce changement sans recharger la page.
    queryClient.invalidateQueries({ queryKey: studentsKeys.all(schoolId) });
  };
}

export interface EndOfYearDecisionPayload {
  studentId: string;
  schoolYearId: string;
  decision: EndOfYearDecisionType;
  targetGroupeId?: string;
  // Itération 44 — demande utilisateur : "si passage en classe supérieure
  // validée, l'élève est inscrit pour l'année suivante [...]. Si
  // redoublement, de même." Exigé pour PASSAGE/REDOUBLEMENT, interdit pour
  // REORIENTATION/DEPART (voir end-of-year.schema.ts côté backend) —
  // toujours choisie/confirmée par le personnel, jamais déduite.
  enrollmentSchoolYearId?: string;
  note?: string;
}

// Upsert par clé métier (studentId, schoolYear) — un seul appel POST sert à
// la fois de création et de correction (voir end-of-year.routes.ts côté
// backend, un seul verbe POST pour ce module).
export function useUpsertEndOfYearDecisionMutation(schoolId: string) {
  const invalidate = useInvalidateEndOfYear(schoolId);
  return useMutation({
    mutationFn: async (payload: EndOfYearDecisionPayload) =>
      (await api.post(`/schools/${schoolId}/end-of-year`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteEndOfYearDecisionMutation(schoolId: string) {
  const invalidate = useInvalidateEndOfYear(schoolId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/schools/${schoolId}/end-of-year/${id}`)).data,
    onSuccess: invalidate,
  });
}
