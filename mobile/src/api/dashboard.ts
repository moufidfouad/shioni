import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { DashboardData } from "../types";

// GET /schools/:schoolId/dashboard — route WEB existante (dashboard.routes.ts),
// réutilisée telle quelle. Réservée au personnel (requireAnySchoolRole) :
// n'est appelée QUE quand l'écran a déjà déterminé, via `school.myRoles`,
// que l'utilisateur courant est bien membre du personnel de cette école
// (voir app/(app)/schools/[schoolId]/dashboard.tsx) — jamais pour un Parent/
// Élève, qui recevrait un 403.
export function useDashboardQuery(schoolId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["dashboard", schoolId],
    queryFn: async () => {
      const { data } = await api.get<DashboardData>(`/schools/${schoolId}/dashboard`);
      return data;
    },
    enabled: Boolean(schoolId) && enabled,
  });
}
