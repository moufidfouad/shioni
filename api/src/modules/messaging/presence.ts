// Registre de présence en mémoire — itération 45, "gestion des utilisateurs
// en ligne / hors ligne". UN utilisateur peut avoir PLUSIEURS sockets ouverts
// en même temps (plusieurs onglets, un ordinateur + un téléphone) : on ne le
// considère "hors ligne" que lorsque son DERNIER socket se déconnecte, jamais
// au premier — d'où un Set de socketIds par utilisateur plutôt qu'un simple
// booléen.
//
// LIMITATION ASSUMÉE ET DOCUMENTÉE : ce registre vit dans la mémoire d'UN
// SEUL process Node (cohérent avec le reste du déploiement de ce bac à
// sable : pas de Redis, pas d'orchestration multi-instance). Avec plusieurs
// instances du backend derrière un load balancer, chaque instance aurait sa
// propre vue partielle de qui est en ligne — un déploiement à l'échelle
// nécessiterait un adaptateur Socket.IO partagé (`@socket.io/redis-adapter`)
// ET de déplacer ce registre dans ce même magasin partagé. Non fait ici,
// comme les autres limitations "mono-process" déjà documentées dans ce
// projet (voir par ex. le commentaire sur les migrations de production non
// exécutables dans ce bac à sable, itération 44).
const onlineSockets = new Map<string, Set<string>>();

/** Enregistre un socket comme actif pour cet utilisateur. Renvoie `true` si
 * c'est le PREMIER socket de cet utilisateur (il vient de passer en ligne). */
export function markOnline(userId: string, socketId: string): boolean {
  const existing = onlineSockets.get(userId);
  if (existing) {
    const wasEmpty = existing.size === 0;
    existing.add(socketId);
    return wasEmpty;
  }
  onlineSockets.set(userId, new Set([socketId]));
  return true;
}

/** Retire un socket. Renvoie `true` si c'était le DERNIER socket de cet
 * utilisateur (il vient de passer hors ligne). */
export function markOffline(userId: string, socketId: string): boolean {
  const existing = onlineSockets.get(userId);
  if (!existing) return false;
  existing.delete(socketId);
  if (existing.size === 0) {
    onlineSockets.delete(userId);
    return true;
  }
  return false;
}

export function isOnline(userId: string): boolean {
  return (onlineSockets.get(userId)?.size ?? 0) > 0;
}

export function getOnlineUserIds(userIds: string[]): Set<string> {
  return new Set(userIds.filter((id) => isOnline(id)));
}
