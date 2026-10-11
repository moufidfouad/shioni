import { MMKV } from "react-native-mmkv";

// Phase 3a (itération 76) — moteur de stockage local SYNCHRONE (voir plan
// mobile, section 4.2 : "react-native-mmkv nettement plus rapide qu'
// AsyncStorage pour ce volume de lecture/écriture"). Sert DEUX usages avec
// la MÊME instance : (1) persistance du cache TanStack Query en lecture
// hors-ligne (voir src/lib/queryClient.ts) ; (2) un repli léger du profil
// utilisateur pour authStore.ts::bootstrap quand l'app démarre sans réseau
// (voir son commentaire). AUCUNE donnée sensible ici — jamais un token
// (src/api/tokenStorage.ts reste seul à toucher expo-secure-store, chiffré) :
// MMKV n'est PAS chiffré par défaut, adapté au cache/lecture, pas à un
// secret.
//
// PIÈGE MOBILE, nouveau à cette itération : `react-native-mmkv` est un
// module natif (JSI) — contrairement à TOUT ce qui a été ajouté jusqu'ici
// (expo-secure-store, socket.io-client, formik... tous compatibles Expo Go),
// il est INCOMPATIBLE avec Expo Go et exige un "custom dev client"
// (`npx expo run:android`/`run:ios`, ou un profil de build EAS — voir
// eas.json, Phase 4 du plan) pour être testé sur un vrai appareil ou
// simulateur. Documenté explicitement dans mobile/README.md — sans effet
// sur la vérification disponible dans cet environnement (tsc + export
// Metro), qui ne dépend pas d'un module natif réel pour compiler.
//
// Version épinglée `3.3.3` (PAS la 4.x, la plus récente au moment d'écrire
// ceci) — délibéré : la 4.x réécrit l'API autour de "Nitro Modules" (classe
// `MMKV` retirée, remplacée par `createMMKV()` + une dépendance
// supplémentaire `react-native-nitro-modules`), un changement d'architecture
// plus récent et moins éprouvé, sans bénéfice pour ce simple usage
// clé/valeur. La 3.3.3 garde le constructeur `new MMKV()` classique,
// stable, documenté, et déjà compatible New Architecture (Expo SDK 57) —
// découvert en confrontant le plan mobile (qui ne fixait aucune version) au
// code réel au moment de l'implémentation, même esprit que d'autres
// ajustements déjà faits en cours de route sur ce projet (ex. le contrat de
// pagination affiné à l'itération 75).
export const storage = new MMKV({ id: "sm-cache" });

// Adaptateur {getItem,setItem,removeItem} — la signature attendue par
// `createSyncStoragePersister` (@tanstack/query-sync-storage-persister,
// voir queryClient.ts) diffère légèrement de l'API native MMKV
// (`getString`/`set`/`delete`).
export const mmkvStorageAdapter = {
  getItem: (key: string): string | null => storage.getString(key) ?? null,
  setItem: (key: string, value: string): void => storage.set(key, value),
  removeItem: (key: string): void => storage.delete(key),
};

// Repli de session hors-ligne — voir authStore.ts::bootstrap. Stocke une
// copie du DERNIER `AuthUser` connu (pas les tokens, déjà en SecureStore),
// mise à jour à chaque `fetchMe()`/login/register réussi, effacée à la
// déconnexion.
const CACHED_USER_KEY = "sm_cached_user";

export function getCachedUser<T>(): T | null {
  const raw = storage.getString(CACHED_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setCachedUser(user: unknown): void {
  storage.set(CACHED_USER_KEY, JSON.stringify(user));
}

export function clearCachedUser(): void {
  storage.delete(CACHED_USER_KEY);
}

// Horodatage de la dernière requête API réussie (n'importe laquelle) — sert
// l'indicateur "dernière synchronisation à ..." demandé explicitement par le
// plan mobile (section 4.6, "plutôt qu'un système de synchronisation
// silencieuse qui masquerait la fraîcheur réelle des données") — voir
// OfflineBanner.tsx, alimenté depuis queryClient.ts.
const LAST_SYNC_KEY = "sm_last_sync_at";

export function markSynced(): void {
  storage.set(LAST_SYNC_KEY, String(Date.now()));
}

export function getLastSyncedAt(): number | null {
  const raw = storage.getString(LAST_SYNC_KEY);
  return raw ? Number(raw) : null;
}

// Phase 3b (itération 78) — dernier jeton push ENREGISTRÉ AUPRÈS DU
// BACKEND pour cet appareil (pas le jeton en lui-même, obtenu à chaque
// démarrage via `Notifications.getExpoPushTokenAsync()` — voir
// src/lib/pushNotifications.ts). Sert uniquement à authStore.ts::logout,
// pour désenregistrer explicitement le bon jeton côté serveur (voir
// push-tokens.service.ts::unregisterToken côté backend) sans avoir à
// redemander la permission système à la déconnexion.
const PUSH_TOKEN_KEY = "sm_push_token";

export function getStoredPushToken(): string | null {
  return storage.getString(PUSH_TOKEN_KEY) ?? null;
}

export function setStoredPushToken(token: string): void {
  storage.set(PUSH_TOKEN_KEY, token);
}

export function clearStoredPushToken(): void {
  storage.delete(PUSH_TOKEN_KEY);
}
