import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { TeachingScope } from "../types";

// GET /schools/:schoolId/me/teaching-scope — route WEB existante
// (me.routes.ts), réutilisée telle quelle. Itération 83 : PREMIER usage
// mobile de cet endpoint (jusqu'ici, Présences/Notes en mobile laissaient
// le serveur seul juge — un ENSEIGNANT hors de sa portée découvrait
// l'erreur au moment d'agir plutôt qu'avant). Nécessaire ici pour filtrer
// le sélecteur de MATIÈRE de la saisie de notes : sans ce filtrage, un
// compte ENSEIGNANT verrait des matières qu'il n'enseigne pas et obtiendrait
// systématiquement un 403 à l'enregistrement — un vrai problème d'usage,
// pas seulement un confort d'affichage (voir notes.tsx::GradesEntry).
export function useMyTeachingScopeQuery(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["me", "teaching-scope", schoolId],
    queryFn: async () => {
      const { data } = await api.get<TeachingScope>(`/schools/${schoolId}/me/teaching-scope`);
      return data;
    },
    enabled: Boolean(schoolId),
    staleTime: 5 * 60 * 1000,
  });
}
