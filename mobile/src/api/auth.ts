import { AxiosError } from "axios";
import { api } from "./client";
import { AuthUser, MobileAuthResponse } from "../types";

// Toutes les erreurs de ce backend renvoient `{ error: string }` (voir
// backend/src/middleware/errorHandler.ts) — petit helper pour extraire un
// message affichable à l'utilisateur plutôt que de laisser fuiter
// "Request failed with status code 401" (message par défaut d'axios).
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return fallback;
}

// Réutilise le même contrat que loginSchema côté backend (`identifier` —
// email, numéro d'élève ou numéro de CIN, voir auth.schema.ts, itération 65)
// — inchangé pour le mobile, ce n'est qu'un nouveau CONTROLLER côté backend
// (mobile-auth.controller.ts), pas une nouvelle forme de requête.
export async function loginRequest(identifier: string, password: string): Promise<MobileAuthResponse> {
  const { data } = await api.post<MobileAuthResponse>("/v1/mobile/auth/login", { identifier, password });
  return data;
}

export async function registerRequest(
  email: string,
  password: string,
  fullName: string
): Promise<MobileAuthResponse> {
  const { data } = await api.post<MobileAuthResponse>("/v1/mobile/auth/register", { email, password, fullName });
  return data;
}

export async function logoutRequest(refreshToken: string | null): Promise<void> {
  await api.post("/v1/mobile/auth/logout", { refreshToken });
}

// GET /auth/me — route WEB existante, PAS sous /v1/mobile/auth : réutilisée
// telle quelle (voir plan mobile, section 1.1 — authenticate() accepte déjà
// le repli Bearer). Utile au démarrage de l'app pour valider un token déjà
// en SecureStore et récupérer le profil à jour (avec les appartenances aux
// écoles, voir auth.service.ts::me), sans repasser par un login.
export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>("/auth/me");
  return data;
}
