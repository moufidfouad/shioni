import { QueryClient, onlineManager } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import NetInfo from "@react-native-community/netinfo";
import { markSynced, mmkvStorageAdapter } from "./storage";

// Instance UNIQUE partagée par toute l'app (montée dans app/_layout.tsx) —
// même rôle que frontend/src/lib/queryClient.ts côté web. `retry: 1` plutôt
// que le défaut (3) : sur un réseau mobile instable, 3 tentatives
// silencieuses avant qu'un écran affiche enfin une erreur donne une
// impression de lenteur ; le rafraîchissement manuel (pull-to-refresh, à
// ajouter écran par écran) est un meilleur retour utilisateur qu'un retry
// automatique agressif.
//
// `gcTime` porté à 24h (Phase 3a, itération 76) — le défaut TanStack Query
// (5 min) supprimerait les données restaurées du cache PERSISTÉ peu après
// l'hydratation si aucun écran ne les consulte immédiatement : le cache
// mémoire et le cache persisté partagent la même horloge de garbage
// collection, `gcTime` doit donc couvrir au moins `PERSIST_MAX_AGE`
// ci-dessous (recommandation officielle TanStack Query pour l'usage avec
// `persistQueryClient`).
const OFFLINE_CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24h

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, gcTime: OFFLINE_CACHE_MAX_AGE },
  },
});

// Horodatage "dernière synchronisation" (voir src/lib/storage.ts et
// OfflineBanner.tsx) — mis à jour à chaque requête qui aboutit avec succès,
// quel que soit l'écran. `event.type === "updated"` se déclenche à chaque
// changement d'état d'une query, filtré sur `status === "success"` pour ne
// compter qu'un vrai succès réseau (pas une simple invalidation ou un
// passage en `pending`).
queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.query.state.status === "success") {
    markSynced();
  }
});

// Persistance du cache en LECTURE hors-ligne (plan mobile, sections 4.2 et
// 4.6) — MMKV via l'adaptateur synchrone de storage.ts.
// `createSyncStoragePersister` (pas la variante "async") : MMKV expose une
// API synchrone, contrairement à AsyncStorage pour lequel le plan mobile
// évoquait initialement `@tanstack/query-async-storage-persister` — choix
// affiné ici après lecture de la documentation TanStack Query au moment de
// l'implémentation réelle (même esprit que la correction du type
// `AttendanceRecord` à l'itération 72 : un détail du plan, écrit avant
// d'avoir le code sous les yeux, corrigé sans en faire un sujet).
export const persister = createSyncStoragePersister({ storage: mmkvStorageAdapter, key: "sm-query-cache" });

// `buster` : identifiant de version du cache persisté — à incrémenter
// manuellement (ex. "v2") si la FORME d'une réponse mise en cache change de
// façon incompatible (ex. un champ renommé/retiré). Un `buster` différent
// de celui utilisé lors de la persistance invalide tout le cache stocké au
// lieu de risquer une hydratation avec une forme de donnée obsolète.
export const PERSIST_BUSTER = "v1";
export const PERSIST_MAX_AGE = OFFLINE_CACHE_MAX_AGE;

// Intègre l'état de connectivité réel de l'appareil (NetInfo) à la gestion
// interne "online/offline" de TanStack Query — sans ce branchement, RN
// n'a pas d'équivalent de l'événement navigateur `online`/`offline` que la
// librairie utilise par défaut sur le web, et les requêtes en échec
// resteraient en attente de retry sans jamais être informées d'un retour de
// réseau. `setEventListener` gère lui-même son propre nettoyage en interne
// (il désabonne l'écouteur précédent s'il est rappelé) — rien à retourner
// ni à désabonner explicitement depuis l'appelant, contrairement à un
// `useEffect` React classique. Appelé une seule fois depuis app/_layout.tsx
// (voir son commentaire) — pas ici directement, pour rester un pur module
// d'export sans effet de bord au chargement.
export function setupOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected));
    });
  });
}
