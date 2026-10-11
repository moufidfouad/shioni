// URL de base de l'API — configurable via la variable d'environnement Expo
// EXPO_PUBLIC_API_URL (préfixe EXPO_PUBLIC_ obligatoire pour qu'Expo
// l'embarque dans le bundle client, voir la doc Expo sur les variables
// d'environnement). Valeur par défaut pensée pour le développement local
// UNIQUEMENT — et volontairement PAS "localhost" :
//
//   - Un simulateur iOS partage le réseau du Mac hôte : "localhost"
//     fonctionnerait là, mais pas ailleurs.
//   - Un émulateur Android voit sa propre machine hôte à l'adresse spéciale
//     10.0.2.2 (jamais localhost/127.0.0.1, qui pointerait vers l'émulateur
//     lui-même) — voir la doc Android officielle.
//   - Un téléphone PHYSIQUE (le cas le plus fréquent en pratique, via
//     l'app Expo Go ou un build de développement) doit utiliser l'adresse IP
//     locale de la machine de développement sur le réseau Wi-Fi partagé
//     (ex. 192.168.1.x), jamais localhost ni 10.0.2.2.
//
// Piège à éviter : ne JAMAIS coder une de ces trois valeurs en dur comme
// unique fallback — définir EXPO_PUBLIC_API_URL dans mobile/.env (copié
// depuis .env.example) selon la cible utilisée à un instant donné, plutôt
// que de modifier ce fichier à chaque changement d'appareil de test.
const DEV_DEFAULT_API_URL = "http://10.0.2.2:4000/api/v1";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || DEV_DEFAULT_API_URL;

// Base SANS /v1 — pour les routes métier existantes (/schools/..., /auth/me),
// consommées telles quelles par le mobile via le repli Authorization: Bearer
// déjà actif côté backend (voir middleware/auth.ts::authenticate, et la
// section 3.2 du plan mobile : inutile de les remonter sous /v1 tant
// qu'aucune rupture de compatibilité ne l'exige).
export const LEGACY_API_URL = API_URL.replace(/\/v1$/, "");

// Base pour Socket.IO (Phase 2c, Messagerie) — Socket.IO écoute sur le même
// serveur HTTP que l'API mais SANS le préfixe `/api` (chemin par défaut
// `/socket.io`, jamais monté sous `/api`, voir backend/src/index.ts). Le web
// se connecte sans URL explicite (`io({ withCredentials: true })`, même
// origine que la page — voir frontend/src/hooks/useMessagingSocket.ts) ; le
// mobile n'a pas d'"origine de page", il doit donc pointer explicitement
// vers l'hôte du backend, dérivé de `LEGACY_API_URL` en retirant `/api`.
export const SOCKET_URL = LEGACY_API_URL.replace(/\/api$/, "");

export const COOKIE_ACCESS_NAME =
  process.env.EXPO_COOKIE_ACCESS_NAME || "sm_access_token";
export const COOKIE_REFRESH_NAME =
  process.env.EXPO_COOKIE_REFRESH_NAME || "sm_refresh_token";
export const COOKIE_CSRF_NAME =
  process.env.EXPO_COOKIE_CSRF_NAME || "sm_csrf_token";
