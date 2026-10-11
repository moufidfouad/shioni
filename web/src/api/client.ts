import axios from "axios";
import { queryClient, ME_KEY } from "../lib/queryClient";

// La session vit dans des cookies httpOnly posés par le backend (voir
// backend/src/utils/cookies.ts) : le frontend ne stocke plus aucun token
// (ni en localStorage, ni en mémoire) et ne pose plus d'en-tête
// Authorization à la main. `withCredentials: true` fait envoyer/accepter
// ces cookies par le navigateur sur chaque requête — en dev le proxy Vite
// rend /api same-origin (voir vite.config.ts), en prod CORS_ORIGIN côté
// backend doit pointer exactement vers l'origine du frontend.
// `timeout: 15000` : une requête qui ne répond jamais (backend down, réseau
// coupé) ne doit pas laisser un `useQuery`/`useMutation` en attente
// indéfiniment — 15s est largement suffisant pour toutes les routes de cette
// API (aucune n'est un traitement long/streaming).
export const api = axios.create({ baseURL: "/api", withCredentials: true, timeout: 15000 });

// Protection CSRF (voir backend/src/utils/csrf.ts) : le backend pose un
// cookie `sm_csrf_token` NON httpOnly (volontairement, contrairement aux
// cookies de session) — on le relit ici et on le recopie dans l'en-tête
// `X-CSRF-Token` sur chaque requête. Inoffensif sur un GET (le backend ne le
// vérifie que sur POST/PUT/PATCH/DELETE), donc appliqué sans condition plutôt
// que de dupliquer la liste des méthodes "unsafe" côté frontend.
function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

api.interceptors.request.use((config) => {
  const csrfToken = readCookie("sm_csrf_token");
  if (csrfToken) {
    config.headers.set("X-CSRF-Token", csrfToken);
  }
  return config;
});

// Rafraîchit automatiquement la session sur un 401 (le refresh token, lui
// aussi en cookie httpOnly, est envoyé automatiquement par le navigateur),
// puis rejoue la requête d'origine. Une seule tentative de refresh à la fois
// même si plusieurs requêtes échouent en même temps ; on ne retente jamais
// sur les routes d'auth elles-mêmes (évite une boucle inutile sur un login
// raté ou un refresh déjà en échec).
const NO_RETRY_PATHS = ["/auth/login", "/auth/register", "/auth/refresh"];
let refreshingPromise: Promise<boolean> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthRoute = typeof original?.url === "string" && NO_RETRY_PATHS.some((p) => original.url.endsWith(p));

    if (error.response?.status === 401 && original && !original._retry && !isAuthRoute) {
      original._retry = true;

      if (!refreshingPromise) {
        refreshingPromise = api
          .post("/auth/refresh")
          .then(() => true)
          .catch(() => {
            // Le refresh token est lui-même invalide/expiré : la session est
            // définitivement terminée côté serveur. On vide le cache
            // `ME_KEY` (staleTime: Infinity côté AuthContext, donc jamais
            // refetch spontanément) pour ne pas laisser un ancien
            // utilisateur "connecté" dans le cache React Query si l'app ne
            // remonte pas entièrement (ex : un futur login dans le même
            // onglet).
            queryClient.removeQueries({ queryKey: ME_KEY });
            return false;
          })
          .finally(() => {
            refreshingPromise = null;
          });
      }

      const refreshed = await refreshingPromise;
      if (refreshed) return api(original);
    }

    return Promise.reject(error);
  }
);
