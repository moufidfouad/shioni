import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { parseCookie } from "cookie";
import { prisma } from "../../config/prisma";
import { verifyAccessToken } from "../../utils/jwt";
import { getAccessCookie } from "../../utils/cookies";
import { env } from "../../config/env";
import { markOnline, markOffline } from "./presence";
import type { MessageDTO } from "./messaging.types";

// Événements que le SERVEUR pousse vers les clients — jamais un chemin
// d'écriture (voir le commentaire d'en-tête de messaging.schema.ts : toute
// mutation passe par REST, Socket.IO ne fait que diffuser ce que REST vient
// de persister, ou des signaux éphémères qui ne sont d'ailleurs jamais
// persistés).
export interface ServerToClientEvents {
  "message:new": (payload: MessageDTO) => void;
  // Signal volontairement minimal (juste l'id) plutôt que la conversation
  // complète : le frontend invalide sa query React Query
  // `["messaging", schoolId, "conversations"]` en réaction, qui refait un
  // GET REST normal — un seul contrat de forme de donnée pour la liste des
  // conversations (le GET REST), jamais une seconde copie poussée par socket
  // qui pourrait diverger avec le temps.
  "conversation:updated": (payload: { conversationId: string }) => void;
  "message:read": (payload: {
    conversationId: string;
    userId: string;
    lastReadMessageId: string;
    lastReadAt: string;
  }) => void;
  typing: (payload: { conversationId: string; userId: string; isTyping: boolean }) => void;
  "presence:update": (payload: { userId: string; online: boolean; lastSeenAt: string | null }) => void;
}

// Événements que le CLIENT peut émettre — UNIQUEMENT des signaux éphémères
// (indicateur de saisie). Envoyer/lire un message, créer une conversation,
// marquer comme lu : toujours REST, jamais un événement ici (voir
// messaging.schema.ts).
export interface ClientToServerEvents {
  "typing:start": (payload: { conversationId: string }) => void;
  "typing:stop": (payload: { conversationId: string }) => void;
}

interface SocketData {
  userId: string;
}

export type MessagingServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type MessagingSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// Exportées : `messaging.service.ts` en a besoin pour cibler ses diffusions
// après une mutation REST (voir `getMessagingIO` plus bas) sans dupliquer la
// convention de nommage des rooms.
export const conversationRoom = (conversationId: string) => `conversation:${conversationId}`;
export const userRoom = (userId: string) => `user:${userId}`;

// Singleton — voir le commentaire sur `getMessagingIO` plus bas pour la
// raison de ce patron plutôt qu'une vraie injection de dépendances.
let ioInstance: MessagingServer | null = null;

// Authentifie le handshake Socket.IO EXACTEMENT comme une requête REST
// authentifiée (`middleware/auth.ts::authenticate`) : même cookie httpOnly
// (`sm_access_token`), même fonction de vérification du JWT
// (`verifyAccessToken`) — pas un second mécanisme d'authentification
// parallèle à maintenir. La différence est mécanique, pas logique : une
// requête HTTP normale expose ses cookies via `req.cookies` (posé par le
// middleware `cookie-parser`, monté dans app.ts) ; une poignée de main
// Socket.IO n'a que l'en-tête `Cookie` brut (`socket.handshake.headers.
// cookie`), qu'on parse nous-mêmes avec le même paquet `cookie` que côté
// client (`parseCookie`) avant de le passer à `getAccessCookie`, dont la
// signature accepte volontairement n'importe quel objet `{ cookies？:
// Record<string,string> }` (voir utils/cookies.ts) — précisément pour
// permettre cette réutilisation.
async function authenticateSocket(socket: MessagingSocket, next: (err?: Error) => void) {
  // Vérification d'origine — l'équivalent, côté WebSocket, de la protection
  // CSRF à double soumission de cookie posée sur les routes REST (voir
  // middleware/csrf.ts) : un cookie httpOnly est envoyé automatiquement par
  // le navigateur sur la poignée de main WebSocket même depuis une page
  // tierce, mais cette dernière ne peut jamais forger un en-tête `Origin`
  // usurpé. On refuse toute poignée de main dont l'origine ne correspond pas
  // exactement à `CORS_ORIGIN` (même valeur que le middleware `cors()`
  // d'Express, voir app.ts) — sauf si l'en-tête est absent (client non-
  // navigateur), cas déjà accepté ailleurs par le repli `Authorization:
  // Bearer` de `authenticate`.
  const origin = socket.handshake.headers.origin;
  if (origin && origin !== env.CORS_ORIGIN) {
    return next(new Error("Origine non autorisée."));
  }

  const cookieHeader = socket.handshake.headers.cookie;
  // `parseCookie` type ses valeurs `string | undefined` (une clé PEUT
  // apparaître sans valeur dans un en-tête Cookie malformé) — `getAccessCookie`
  // (utils/cookies.ts) est déjà écrite pour un objet `Record<string,string>`
  // ordinaire (le type que pose `cookie-parser` côté Express) ; un simple
  // accès par clé se comporte identiquement dans les deux cas au runtime
  // (`undefined` si absente), d'où ce cast plutôt qu'une seconde signature.
  const cookies = (cookieHeader ? parseCookie(cookieHeader) : {}) as Record<string, string>;
  const token = getAccessCookie({ cookies }) || (socket.handshake.auth?.token as string | undefined);

  if (!token) return next(new Error("Authentification requise."));

  try {
    const payload = verifyAccessToken(token);
    socket.data.userId = payload.sub;
    next();
  } catch {
    next(new Error("Jeton invalide ou expiré."));
  }
}

// À la connexion, un socket rejoint automatiquement la room de CHACUNE des
// conversations où son utilisateur est déjà participant — pas besoin d'un
// événement client "conversation:join" (qui obligerait à revalider
// l'appartenance à chaque appel) : la liste vient directement de la base,
// donc impossible de rejoindre la room d'une conversation à laquelle on
// n'appartient pas.
async function joinOwnConversationRooms(socket: MessagingSocket) {
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId: socket.data.userId },
    select: { conversationId: true },
  });
  socket.join(userRoom(socket.data.userId));
  for (const { conversationId } of participations) {
    socket.join(conversationRoom(conversationId));
  }
}

// Diffuse le statut de présence uniquement aux personnes qui PARTAGENT au
// moins une conversation avec cet utilisateur (jamais une diffusion globale
// à tout le serveur) — cohérent avec le cadrage "tout membre d'une même
// école" : un utilisateur d'une autre école, avec qui aucune conversation
// n'existe, ne voit jamais le statut en ligne de quelqu'un qu'il ne peut de
// toute façon pas contacter.
async function broadcastPresence(io: MessagingServer, userId: string, online: boolean) {
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true },
  });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { lastSeenAt: true } });
  const payload = { userId, online, lastSeenAt: user?.lastSeenAt?.toISOString() ?? null };
  for (const { conversationId } of participations) {
    io.to(conversationRoom(conversationId)).emit("presence:update", payload);
  }
}

export function initMessagingSocket(httpServer: HttpServer): MessagingServer {
  const io: MessagingServer = new Server(httpServer, {
    // Chemin par défaut ("/socket.io") laissé tel quel — le proxy de dev
    // Vite (voir frontend/vite.config.ts) et un reverse proxy de production
    // n'ont qu'une seule route à transférer en `ws: true`.
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  io.use((socket, next) => {
    authenticateSocket(socket as MessagingSocket, next).catch(next);
  });

  io.on("connection", (socket: MessagingSocket) => {
    const userId = socket.data.userId;

    joinOwnConversationRooms(socket)
      .then(async () => {
        const becameOnline = markOnline(userId, socket.id);
        if (becameOnline) await broadcastPresence(io, userId, true);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[messaging socket] échec de la jonction des rooms à la connexion :", err);
      });

    // Indicateur de saisie — jamais persisté (voir schema.prisma::Message,
    // aucun champ ne le concerne), diffusé à tous les autres participants de
    // la conversation (`socket.to(...)`, exclut l'émetteur lui-même).
    socket.on("typing:start", ({ conversationId }) => {
      socket.to(conversationRoom(conversationId)).emit("typing", { conversationId, userId, isTyping: true });
    });
    socket.on("typing:stop", ({ conversationId }) => {
      socket.to(conversationRoom(conversationId)).emit("typing", { conversationId, userId, isTyping: false });
    });

    socket.on("disconnect", () => {
      const wentOffline = markOffline(userId, socket.id);
      if (!wentOffline) return;
      prisma.user
        .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
        .then(() => broadcastPresence(io, userId, false))
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error("[messaging socket] échec de la mise à jour de présence à la déconnexion :", err);
        });
    });
  });

  ioInstance = io;
  return io;
}

// Point d'accès utilisé par `messaging.service.ts` pour diffuser un
// événement APRÈS qu'une mutation REST a persisté son résultat (voir le
// commentaire d'en-tête de messaging.schema.ts). Un singleton plutôt qu'une
// vraie injection de dépendances : même patron pragmatique que `prisma`
// (config/prisma.ts, instance unique importée partout) — cohérent avec le
// reste d'un projet qui n'a jamais utilisé de conteneur d'injection de
// dépendances. Peut renvoyer `null` UNIQUEMENT si le service est importé
// avant `initMessagingSocket()` (jamais le cas en usage normal, `index.ts`
// initialise le socket avant que les requêtes HTTP ne soient acceptées) —
// chaque appelant vérifie explicitement plutôt que de supposer une valeur
// non nulle.
export function getMessagingIO(): MessagingServer | null {
  return ioInstance;
}

export function joinUserToConversationRoom(userId: string, conversationId: string) {
  ioInstance?.in(userRoom(userId)).socketsJoin(conversationRoom(conversationId));
}

// Symétrique — appelé quand `messaging.service.ts::removeParticipant` retire
// quelqu'un d'un groupe : sans ça, un socket déjà connecté continuerait à
// recevoir les messages du groupe qu'il vient pourtant de quitter jusqu'à sa
// prochaine reconnexion.
export function leaveUserConversationRoom(userId: string, conversationId: string) {
  ioInstance?.in(userRoom(userId)).socketsLeave(conversationRoom(conversationId));
}
