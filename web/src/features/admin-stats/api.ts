import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { GlobalStatsOverview } from "../../types";

// Itération 67 — statistiques globales superadmin (toutes écoles), voir
// pages/admin/GlobalStatsPage.tsx. Lecture seule, même patron que
// useAnalyticsQuery (features/analytics/api.ts) mais sans schoolId : agrégat
// transversal réservé au superadmin (`requireSuperAdmin`, voir
// admin-stats.routes.ts).
export function useGlobalStatsQuery(enabled = true) {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async ({ signal }) => (await api.get<GlobalStatsOverview>("/admin/stats", { signal })).data,
    enabled,
  });
}
