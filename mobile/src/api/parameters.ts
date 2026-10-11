import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { SchoolParametersSummary } from "../types";

// GET /schools/:schoolId/parameters — route WEB existante
// (parameters.routes.ts), réutilisée telle quelle, ouverte à tout membre du
// personnel (requireAnySchoolRole). La réponse réelle contient bien plus de
// champs (feeLevels, cycles, series, salles, schoolYears...) — seuls
// `nbTrimestres`/`trimestreEnCours`/`classes`/`groupes` sont typés côté
// mobile pour l'instant (voir SchoolParametersSummary, src/types/index.ts),
// les champs non déclarés ici sont simplement ignorés par TypeScript, pas
// perdus au runtime.
export function useSchoolParametersQuery(schoolId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["parameters", schoolId],
    queryFn: async () => {
      const { data } = await api.get<SchoolParametersSummary>(`/schools/${schoolId}/parameters`);
      return data;
    },
    enabled: Boolean(schoolId) && enabled,
  });
}
