import axios, { AxiosError } from "axios";
import { LEGACY_API_URL } from "../config";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokenStorage";

// Phase 3a (itération 76, offline en lecture) — distingue une requête qui a
// échoué faute de RÉSEAU (aucune réponse serveur reçue du tout,
// `err.response === undefined`) d'un échec applicatif (401, 403, 500...).
// Utilisé par authStore.ts::bootstrap pour ne JAMAIS effacer une session
// valide simplement parce que l'appareil est hors ligne au démarrage — voir
// le commentaire détaillé là-bas.
export function isNetworkError(err: unknown): boolean {
  return err instanceof AxiosError && !err.response;
}

// Contrairement au web (frontend/src/api/client.ts, cookies httpOnly +
// withCredentials: true), le mobile n'a pas de cookie : le token vit en
// SecureStore et est posé explicitement en en-tête Authorization — c'est
// EXACTEMENT le mécanisme que backend/src/middleware/auth.ts::authenticate
// accepte déjà en repli du cookie, donc AUCUN changement de vérification
// côté backend (voir plan mobile, section 2.5). `baseURL` pointe sur
// /api (SANS /v1) : les routes métier existantes (/schools/..., /auth/me)
// ne sont pas versionnées (voir section 3.2 du plan) ; seules les routes
// d'authentification mobile utilisent le préfixe /v1 explicitement dans
// leur chemin d'appel (voir src/api/auth.ts).
export const api = axios.create({ baseURL: LEGACY_API_URL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  // Pas de header X-CSRF-Token ici : un appel Bearer est exempté du contrôle
  // CSRF côté backend (voir middleware/csrf.ts, itération 69) — la
  // double-soumission de cookie n'a de sens que pour un client qui a un
  // cookie, ce que le mobile n'a jamais.
  return config;
});

// Même logique de refresh automatique sur 401 que le web
// (frontend/src/api/client.ts), adaptée : le refresh token est lui aussi en
// SecureStore (jamais en cookie côté mobile), donc envoyé explicitement dans
// le corps de la requête plutôt que porté automatiquement par le navigateur.
const NO_RETRY_PATHS = ["/v1/mobile/auth/login", "/v1/mobile/auth/register", "/v1/mobile/auth/refresh"];
let refreshingPromise: Promise<boolean> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthRoute = typeof original?.url === "string" && NO_RETRY_PATHS.some((p) => original.url.endsWith(p));

    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;

      if (!refreshingPromise) {
        refreshingPromise = (async () => {
          try {
            const refreshToken = await getRefreshToken();
            if (!refreshToken) return false;
            const { data } = await api.post("/v1/mobile/auth/refresh", { refreshToken });
            await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
            return true;
          } catch {
            await clearTokens();
            return false;
          } finally {
            refreshingPromise = null;
          }
        })();
      }

      if (await refreshingPromise) return api(original);
    }

    return Promise.reject(error);
  }
);
