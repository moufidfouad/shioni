import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { Subject } from "../types";

// GET /schools/:schoolId/subjects — route WEB existante (subjects.routes.ts),
// réutilisée telle quelle, ouverte à tout membre du personnel
// (requireAnySchoolRole). Itération 83 : lecture seule côté mobile (création/
// modification de matière et de coefficients reste réservée au web, action
// de configuration ponctuelle plus naturelle depuis un poste web, même choix
// que le logo d'école — voir students.ts). Utilisée par l'écran de saisie de
// notes pour filtrer les matières RÉELLEMENT enseignées dans la classe
// choisie (`coefficients.some(c => c.groupeId === groupeId)`), pas seulement
// pour du RBAC — sans ce filtre la liste inclurait des matières sans lien
// avec la classe sélectionnée.
export function useSubjectsQuery(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["subjects", schoolId],
    queryFn: async () => {
      const { data } = await api.get<Subject[]>(`/schools/${schoolId}/subjects`);
      return data;
    },
    enabled: Boolean(schoolId),
  });
}
