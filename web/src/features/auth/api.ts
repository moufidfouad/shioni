import { api } from "../../api/client";
import { AuthUser } from "../../types";

// Couche "api" du module auth : tous les appels HTTP bruts vivent ici,
// consommés par `context/AuthContext.tsx` (état global de session, partagé
// par toute l'app, donc pas lui-même un hook React Query "par page") et par
// les pages de ce module (`LoginPage`, `RegisterPage`, `AccountPage`).

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    return (await api.get<AuthUser>("/auth/me")).data;
  } catch {
    return null;
  }
}

// Itération 65 — `identifier` (plus `email`) : un élève peut se connecter
// avec son email, son numéro d'élève (ministère) ou son numéro de carte
// d'identité nationale (voir auth.service.ts::findUserByIdentifier côté
// backend, qui fait la résolution vers le bon compte).
export async function loginRequest(identifier: string, password: string): Promise<AuthUser> {
  return (await api.post("/auth/login", { identifier, password })).data.user as AuthUser;
}

export async function registerRequest(email: string, password: string, fullName: string): Promise<AuthUser> {
  return (await api.post("/auth/register", { email, password, fullName })).data.user as AuthUser;
}

export async function logoutRequest(): Promise<void> {
  await api.post("/auth/logout").catch(() => {});
}

// Changement de mot de passe par l'utilisateur connecté — demande explicite
// : "un utilisateur doit pouvoir changer son mot de passe". Utilisé par
// `AccountPage.tsx`, pas par le contexte d'auth (ce n'est pas un état global
// qui affecte toute l'app, juste une action ponctuelle).
export async function changePasswordRequest(currentPassword: string, newPassword: string): Promise<void> {
  await api.patch("/auth/password", { currentPassword, newPassword });
}
