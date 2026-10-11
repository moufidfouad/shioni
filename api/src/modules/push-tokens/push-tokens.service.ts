import { prisma } from "../../config/prisma";

// Itération 78 — plan mobile Phase 3b (section 4.1). Voir le commentaire du
// modèle `PushToken` (schema.prisma) pour la justification du choix
// d'`upsert` par TOKEN (pas par `(userId, token)`) : un jeton d'appareil
// change de propriétaire s'il change de compte connecté, il ne s'accumule
// jamais pour plusieurs comptes à la fois.
export async function registerToken(userId: string, token: string, platform: string): Promise<void> {
  await prisma.pushToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { userId, platform },
  });
}

// Retrait explicite (déconnexion mobile, voir mobile/src/store/authStore.ts
// ::logout) — restreint à `userId` en plus de `token` : un utilisateur ne
// peut jamais retirer le jeton d'un AUTRE compte, même s'il en devine la
// valeur (peu probable — un jeton Expo Push est un identifiant opaque assez
// long — mais autant ne pas s'y fier). `deleteMany` plutôt que `delete` :
// n'échoue pas silencieusement si le jeton a déjà été réattribué à un autre
// compte entre-temps (voir registerToken ci-dessus) ou n'existe déjà plus —
// un logout ne doit jamais échouer pour cette raison secondaire (même
// principe "best-effort" que authService.logout côté refresh token).
export async function unregisterToken(userId: string, token: string): Promise<void> {
  await prisma.pushToken.deleteMany({ where: { userId, token } });
}

// Consommé par messaging.service.ts::sendMessage — un ou plusieurs jetons
// par utilisateur (plusieurs appareils connectés au même compte).
export async function getTokensForUsers(userIds: string[]): Promise<Array<{ userId: string; token: string }>> {
  if (userIds.length === 0) return [];
  const rows = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, token: true },
  });
  return rows as Array<{ userId: string; token: string }>;
}

// Itération 82 — consommé par utils/expoPush.ts (suivi des reçus de
// livraison) : purge d'un ou plusieurs jetons devenus invalides (appareil
// désinstallé, jeton révoqué — Expo renvoie `DeviceNotRegistered`), qu'ils
// appartiennent à un ou plusieurs comptes différents. `deleteMany` par
// TOKEN uniquement (pas par userId, contrairement à `unregisterToken`
// ci-dessus) : cette purge est déclenchée par le service Expo Push
// lui-même, pas par l'utilisateur concerné — il n'y a pas de compte "à
// vérifier" ici, seulement des jetons dont on sait qu'ils ne mènent plus
// nulle part.
export async function removeTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await prisma.pushToken.deleteMany({ where: { token: { in: tokens } } });
}
