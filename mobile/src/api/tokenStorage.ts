import * as SecureStore from "expo-secure-store";
import { COOKIE_ACCESS_NAME, COOKIE_REFRESH_NAME } from "../config";

// Centralise tout accès aux tokens — seul endroit du projet mobile qui doit
// changer si la stratégie de stockage évolue un jour (même raisonnement que
// backend/src/utils/cookies.ts côté web : un seul point de vérité).
// `expo-secure-store` UNIQUEMENT (chiffré, Keychain iOS / Keystore Android) —
// voir le piège documenté dans le plan mobile ("Ne jamais stocker un token en
// AsyncStorage") : un JWT est une donnée sensible au même titre qu'un mot de
// passe, jamais stockée en clair.
const ACCESS_TOKEN_KEY = COOKIE_ACCESS_NAME;
const REFRESH_TOKEN_KEY = COOKIE_REFRESH_NAME;

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setTokens(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
