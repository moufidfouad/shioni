import { api } from "./client";
import { PushPlatform } from "../lib/pushNotifications";

// POST /v1/mobile/push-tokens — nouveau module backend (plan mobile,
// section 4.1), monté à côté de /v1/mobile/auth plutôt que sous
// /schools/:schoolId/... : un jeton d'appareil appartient au COMPTE, pas à
// une école en particulier (le même appareil doit pouvoir recevoir des
// notifications pour toutes les écoles où l'utilisateur est membre).
export async function registerPushToken(token: string, platform: PushPlatform): Promise<void> {
  await api.post("/v1/mobile/push-tokens", { token, platform });
}

export async function unregisterPushToken(token: string): Promise<void> {
  await api.post("/v1/mobile/push-tokens/unregister", { token });
}
