import { QueryClient } from "@tanstack/react-query";

// Client React Query partagé par toute l'application. `staleTime` à 10s
// évite un refetch systématique en changeant d'onglet/de page pour des
// données qui bougent peu (paramètres, matières...) ; chaque hook peut
// surcharger cette valeur au besoin. `retry: false` : les erreurs 4xx de
// cette API (validation, RBAC) ne doivent jamais être retentées
// automatiquement, et le rafraîchissement de session sur 401 est déjà géré
// par l'intercepteur axios (`src/api/client.ts`), pas par React Query.

// Clé de la query `/auth/me` (voir `src/context/AuthContext.tsx`), partagée
// ici plutôt que définie localement dans AuthContext : `src/api/client.ts`
// doit pouvoir invalider ce cache précis depuis son intercepteur de réponse
// (échec du refresh de session) sans créer de cycle d'imports
// api/client.ts -> context/AuthContext.tsx -> features/auth/api.ts ->
// api/client.ts.
export const ME_KEY = ["auth", "me"] as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
