import fs from "fs";
import path from "path";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { hasSchoolAccess } from "../../middleware/auth";
import { env } from "../../config/env";
import { getMessagingIO, conversationRoom, joinUserToConversationRoom, leaveUserConversationRoom } from "./socket";
import { getOnlineUserIds } from "./presence";
import { getTokensForUsers } from "../push-tokens/push-tokens.service";
import { sendExpoPushNotifications } from "../../utils/expoPush";
import type { CreateConversationInput } from "./messaging.schema";
import type { ConversationParticipantDTO, ConversationSummaryDTO, MessageDTO } from "./messaging.types";

// Couche "service" du module Messagerie (itération 45) — voir le commentaire
// d'en-tête de messaging.schema.ts pour le partage des responsabilités entre
// REST (toute écriture) et Socket.IO (diffusion uniquement). Chaque fonction
// d'écriture ci-dessous suit le même patron en trois temps : (1) persister
// via Prisma, (2) construire le DTO à renvoyer au client REST appelant, (3)
// diffuser ce même DTO aux AUTRES participants déjà connectés via
// `getMessagingIO()` — jamais l'inverse (un événement socket qui
// déclencherait lui-même une écriture).

const senderSelect = { select: { id: true, fullName: true } } as const;

// Deux ids utilisateur triés par ordre lexical et joints par ":" — voir le
// commentaire complet sur `Conversation.privateKey` dans schema.prisma.
export function buildPrivateKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(":");
}

async function assertParticipant(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw ApiError.forbidden("Vous ne participez pas à cette conversation.");
  return participant;
}

// Charge la conversation ET vérifie en même temps qu'elle appartient bien à
// `schoolId` ET que `userId` y participe — les DEUX vérifications sont
// systématiquement combinées (jamais l'une sans l'autre) pour ne jamais
// laisser un utilisateur d'une école A deviner l'existence d'une conversation
// de l'école B par un id partagé dans l'URL.
async function getConversationForParticipant(schoolId: string, conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, schoolId } });
  if (!conversation) throw ApiError.notFound("Conversation introuvable dans cette école.");
  await assertParticipant(conversationId, userId);
  return conversation;
}

function toMessageDTO(message: {
  id: string;
  conversationId: string;
  seq: number;
  senderId: string;
  sender: { id: string; fullName: string };
  content: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
  createdAt: Date;
}): MessageDTO {
  return {
    id: message.id,
    conversationId: message.conversationId,
    seq: message.seq,
    senderId: message.senderId,
    sender: message.sender,
    content: message.content,
    attachmentName: message.attachmentName,
    attachmentType: message.attachmentType,
    attachmentSize: message.attachmentSize,
    hasAttachment: Boolean(message.attachmentUrl),
    createdAt: message.createdAt.toISOString(),
  };
}

// ----------------------------------------------------------------------------
// Contacts — "à qui puis-je écrire dans cette école" (cadrage `AskUserQuestion`
// : tout membre — personnel, parent, élève — de la même école, jamais d'une
// autre). Trois sources distinctes fusionnées et dédupliquées par userId (un
// même compte pourrait en théorie apparaître via deux sources — cas limite
// non traité spécifiquement, même choix assumé qu'ailleurs dans ce projet
// pour `School.isGuardian`/`isStudent`, voir types/index.ts côté frontend).
// ----------------------------------------------------------------------------
export interface ContactDTO {
  id: string;
  fullName: string;
  kind: "STAFF" | "PARENT" | "STUDENT";
}

export async function listContacts(schoolId: string, meId: string): Promise<ContactDTO[]> {
  // Pas de `distinct` côté Prisma ici : un même utilisateur peut avoir
  // plusieurs `SchoolMembership` (un rôle par ligne, voir schema.prisma) donc
  // plusieurs lignes pour la même école — la déduplication se fait ci-dessous
  // par le `Map` indexé sur `userId` (première source rencontrée gagne),
  // plus simple et plus lisible qu'un `distinct` Prisma dont le comportement
  // exact avec `select` imbriqué est facilement piégeux.
  const [staff, guardians, students] = await Promise.all([
    prisma.schoolMembership.findMany({
      where: { schoolId },
      select: { user: { select: { id: true, fullName: true } } },
    }),
    prisma.studentGuardian.findMany({
      where: { student: { schoolId } },
      select: { user: { select: { id: true, fullName: true } } },
    }),
    prisma.student.findMany({
      where: { schoolId, userId: { not: null } },
      select: { user: { select: { id: true, fullName: true } } },
    }),
  ]);

  const byId = new Map<string, ContactDTO>();
  for (const { user } of staff) byId.set(user.id, { id: user.id, fullName: user.fullName, kind: "STAFF" });
  for (const { user } of guardians) if (!byId.has(user.id)) byId.set(user.id, { id: user.id, fullName: user.fullName, kind: "PARENT" });
  for (const { user } of students) {
    if (user && !byId.has(user.id)) byId.set(user.id, { id: user.id, fullName: user.fullName, kind: "STUDENT" });
  }

  byId.delete(meId);
  return [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

// ----------------------------------------------------------------------------
// Conversations
// ----------------------------------------------------------------------------

async function toConversationSummary(
  conversation: { id: string; type: string; title: string | null; updatedAt: Date },
  meId: string
): Promise<ConversationSummaryDTO> {
  const [participants, lastMessageRow, myParticipant] = await Promise.all([
    prisma.conversationParticipant.findMany({
      where: { conversationId: conversation.id },
      select: { userId: true, role: true, user: { select: { fullName: true } } },
    }),
    prisma.message.findFirst({
      where: { conversationId: conversation.id },
      orderBy: { seq: "desc" },
      include: { sender: senderSelect },
    }),
    prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: conversation.id, userId: meId } },
    }),
  ]);

  const participantDTOs: ConversationParticipantDTO[] = participants.map((p) => ({
    userId: p.userId,
    fullName: p.user.fullName,
    role: p.role,
  }));

  const displayName =
    conversation.type === "GROUP"
      ? conversation.title ?? "Groupe"
      : participantDTOs.find((p) => p.userId !== meId)?.fullName ?? "Conversation";

  const unreadCount = await prisma.message.count({
    where: {
      conversationId: conversation.id,
      senderId: { not: meId },
      createdAt: myParticipant?.lastReadAt ? { gt: myParticipant.lastReadAt } : undefined,
    },
  });

  return {
    id: conversation.id,
    type: conversation.type as "PRIVATE" | "GROUP",
    displayName,
    participants: participantDTOs,
    myRole: (myParticipant?.role as "MEMBER" | "ADMIN") ?? "MEMBER",
    lastMessage: lastMessageRow ? toMessageDTO(lastMessageRow) : null,
    unreadCount,
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export async function listConversations(schoolId: string, meId: string): Promise<ConversationSummaryDTO[]> {
  const conversations = await prisma.conversation.findMany({
    where: { schoolId, participants: { some: { userId: meId } } },
    orderBy: { updatedAt: "desc" },
  });
  return Promise.all(conversations.map((c) => toConversationSummary(c, meId)));
}

export async function getConversation(schoolId: string, conversationId: string, meId: string) {
  const conversation = await getConversationForParticipant(schoolId, conversationId, meId);
  return toConversationSummary(conversation, meId);
}

export async function createConversation(schoolId: string, meId: string, input: CreateConversationInput) {
  // Toujours exclure le créateur d'une liste de destinataires qu'il aurait
  // pu (par erreur ou redondance côté client) inclure lui-même.
  const otherIds = [...new Set(input.participantUserIds.filter((id) => id !== meId))];
  if (otherIds.length === 0) throw ApiError.badRequest("Choisissez au moins un autre participant.");

  for (const userId of otherIds) {
    if (!(await hasSchoolAccess(userId, schoolId))) {
      throw ApiError.badRequest("Un des destinataires choisis n'appartient pas à cette école.");
    }
  }

  if (input.type === "PRIVATE") {
    const privateKey = buildPrivateKey(meId, otherIds[0]);
    const existing = await prisma.conversation.findFirst({ where: { schoolId, privateKey } });
    // Idempotent — retenter une création entre les deux mêmes utilisateurs
    // renvoie la conversation déjà existante plutôt que d'en créer une
    // seconde (voir le commentaire sur `Conversation.privateKey`).
    if (existing) return toConversationSummary(existing, meId);

    const conversation = await prisma.conversation.create({
      data: {
        schoolId,
        type: "PRIVATE",
        privateKey,
        createdById: meId,
        participants: {
          createMany: { data: [{ userId: meId }, { userId: otherIds[0] }] },
        },
      },
    });
    for (const userId of [meId, otherIds[0]]) joinUserToConversationRoom(userId, conversation.id);
    // Symétrique à la branche GROUP ci-dessous : sans cet événement, l'AUTRE
    // participant (celui qui n'a pas initié la création) ne verrait la
    // nouvelle conversation apparaître qu'au prochain rafraîchissement
    // périodique (`refetchInterval: 30_000`, voir features/messaging/api.ts)
    // plutôt qu'immédiatement — corrigé lors de la relecture finale.
    getMessagingIO()?.to(conversationRoom(conversation.id)).emit("conversation:updated", { conversationId: conversation.id });
    return toConversationSummary(conversation, meId);
  }

  // GROUP — le créateur devient ADMIN (cadrage utilisateur explicite : "pour
  // les groupes, le créateur devient l'administrateur, peut ajouter/retirer
  // des membres" — voir schema.prisma::ParticipantRole).
  const conversation = await prisma.conversation.create({
    data: {
      schoolId,
      type: "GROUP",
      title: input.title,
      createdById: meId,
      participants: {
        createMany: {
          data: [
            { userId: meId, role: "ADMIN" },
            ...otherIds.map((userId) => ({ userId, role: "MEMBER" as const })),
          ],
        },
      },
    },
  });
  for (const userId of [meId, ...otherIds]) joinUserToConversationRoom(userId, conversation.id);
  getMessagingIO()?.to(conversationRoom(conversation.id)).emit("conversation:updated", { conversationId: conversation.id });
  return toConversationSummary(conversation, meId);
}

// ----------------------------------------------------------------------------
// Messages
// ----------------------------------------------------------------------------

export interface ListMessagesResult {
  data: MessageDTO[];
  nextCursor: number | null;
}

// Pagination par curseur (`seq`), PLUS ANCIENS en premier dans la page
// renvoyée (ordre chronologique direct, prêt à être affiché tel quel/ajouté
// en tête de la liste déjà chargée) — voir le commentaire sur `Message.seq`
// dans schema.prisma pour la raison de ce choix face au contrat page/
// pageSize partagé du reste de l'application.
export async function listMessages(
  schoolId: string,
  conversationId: string,
  meId: string,
  opts: { before?: number; limit: number }
): Promise<ListMessagesResult> {
  await getConversationForParticipant(schoolId, conversationId, meId);

  const rows = await prisma.message.findMany({
    where: { conversationId, seq: opts.before ? { lt: opts.before } : undefined },
    orderBy: { seq: "desc" },
    take: opts.limit,
    include: { sender: senderSelect },
  });

  const chronological = rows.slice().reverse();
  const nextCursor = rows.length === opts.limit ? rows[rows.length - 1].seq : null;

  return { data: chronological.map(toMessageDTO), nextCursor };
}

interface SendMessageOptions {
  content?: string;
  attachment?: { filename: string; originalName: string; mimeType: string; size: number };
}

export async function sendMessage(
  schoolId: string,
  conversationId: string,
  meId: string,
  opts: SendMessageOptions
): Promise<MessageDTO> {
  await getConversationForParticipant(schoolId, conversationId, meId);

  if (!opts.content && !opts.attachment) {
    throw ApiError.badRequest("Un message doit contenir du texte ou une pièce jointe.");
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId: meId,
        content: opts.content ?? null,
        attachmentUrl: opts.attachment?.filename ?? null,
        attachmentName: opts.attachment?.originalName ?? null,
        attachmentType: opts.attachment?.mimeType ?? null,
        attachmentSize: opts.attachment?.size ?? null,
      },
      include: { sender: senderSelect },
    }),
    // Touché à chaque nouveau message — voir le commentaire sur
    // `Conversation.updatedAt` (tri "plus récent en haut" de la liste).
    prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);

  const dto = toMessageDTO(message);
  const io = getMessagingIO();
  io?.to(conversationRoom(conversationId)).emit("message:new", dto);
  io?.to(conversationRoom(conversationId)).emit("conversation:updated", { conversationId });

  // Itération 78 — plan mobile Phase 3b (section 4.1) : SEUL déclencheur de
  // notification push implémenté (le seul déjà entièrement cadré par le
  // plan — voir son commentaire d'en-tête pour ce qui reste explicitement
  // hors périmètre). Volontairement NI attendu NI dans le `$transaction`
  // ci-dessus : un échec du service Expo Push ne doit jamais faire échouer
  // ni ralentir l'envoi du message lui-même — voir utils/expoPush.ts.
  void notifyOfflineParticipants(schoolId, conversationId, meId, message.sender.fullName, dto);

  return dto;
}

// N'avertit que les participants qui ne sont PAS déjà connectés au socket
// de messagerie — inutile de doubler d'une notification système un
// utilisateur qui voit déjà le message arriver en temps réel à l'écran
// (voir presence.ts pour le registre de présence en mémoire). Le sujet
// (`meId`) n'est jamais son propre destinataire, exclu de la requête
// directement plutôt que filtré après coup.
async function notifyOfflineParticipants(
  schoolId: string,
  conversationId: string,
  meId: string,
  senderName: string,
  message: MessageDTO
): Promise<void> {
  const others = await prisma.conversationParticipant.findMany({
    where: { conversationId, userId: { not: meId } },
    select: { userId: true },
  });
  const otherIds = (others as Array<{ userId: string }>).map((p) => p.userId);
  if (otherIds.length === 0) return;

  const onlineIds = getOnlineUserIds(otherIds);
  const offlineIds = otherIds.filter((id) => !onlineIds.has(id));
  if (offlineIds.length === 0) return;

  const tokens = await getTokensForUsers(offlineIds);
  if (tokens.length === 0) return;

  const body = message.content
    ? message.content.length > 120
      ? `${message.content.slice(0, 117)}...`
      : message.content
    : "📎 Pièce jointe";

  await sendExpoPushNotifications(
    tokens.map((t) => ({
      to: t.token,
      title: senderName,
      body,
      // `schoolId` ajouté à l'itération 82 (navigation directe au tap sur
      // la notification, voir mobile/src/lib/pushNotifications.ts) —
      // `conversationId` seul ne suffit pas à construire la route Expo
      // Router (`/schools/:schoolId/messaging/:conversationId`).
      data: { schoolId, conversationId },
    }))
  );
}

export async function markConversationRead(schoolId: string, conversationId: string, meId: string) {
  await getConversationForParticipant(schoolId, conversationId, meId);

  const lastMessage = await prisma.message.findFirst({ where: { conversationId }, orderBy: { seq: "desc" } });
  const lastReadAt = new Date();

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: meId } },
    data: { lastReadAt, lastReadMessageId: lastMessage?.id ?? null },
  });

  if (lastMessage) {
    getMessagingIO()
      ?.to(conversationRoom(conversationId))
      .emit("message:read", {
        conversationId,
        userId: meId,
        lastReadMessageId: lastMessage.id,
        lastReadAt: lastReadAt.toISOString(),
      });
  }
}

// ----------------------------------------------------------------------------
// Participants (groupes uniquement — voir schema.prisma::ParticipantRole)
// ----------------------------------------------------------------------------

async function assertGroupAdmin(conversationId: string, meId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.type !== "GROUP") {
    throw ApiError.badRequest("Cette action n'est possible que sur une conversation de groupe.");
  }
  const participant = await assertParticipant(conversationId, meId);
  if (participant.role !== "ADMIN") {
    throw ApiError.forbidden("Seul un administrateur du groupe peut effectuer cette action.");
  }
  return conversation;
}

export async function addParticipant(schoolId: string, conversationId: string, meId: string, userId: string) {
  await getConversationForParticipant(schoolId, conversationId, meId);
  await assertGroupAdmin(conversationId, meId);

  if (!(await hasSchoolAccess(userId, schoolId))) {
    throw ApiError.badRequest("Cet utilisateur n'appartient pas à cette école.");
  }
  const already = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (already) throw ApiError.conflict("Cette personne fait déjà partie du groupe.");

  await prisma.conversationParticipant.create({ data: { conversationId, userId, role: "MEMBER" } });
  joinUserToConversationRoom(userId, conversationId);
  getMessagingIO()?.to(conversationRoom(conversationId)).emit("conversation:updated", { conversationId });
  return toConversationSummary(await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } }), meId);
}

// `targetUserId === meId` : un membre quitte lui-même le groupe (autorisé
// sans être admin). Sinon : réservé aux administrateurs (voir
// `assertGroupAdmin`). Limitation assumée et documentée, comme ailleurs dans
// ce projet (ex. le retour PASSAGE→DEPART, itération 43) : si le DERNIER
// administrateur quitte le groupe, celui-ci se retrouve sans administrateur
// — aucune promotion automatique du membre le plus ancien n'est faite ici,
// un cas jugé assez rare pour ne pas justifier cette logique supplémentaire
// dans cette première itération.
export async function removeParticipant(
  schoolId: string,
  conversationId: string,
  meId: string,
  targetUserId: string
) {
  await getConversationForParticipant(schoolId, conversationId, meId);
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.type !== "GROUP") {
    throw ApiError.badRequest("Cette action n'est possible que sur une conversation de groupe.");
  }
  if (targetUserId !== meId) await assertGroupAdmin(conversationId, meId);

  const target = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  });
  if (!target) throw ApiError.notFound("Cette personne ne fait pas partie du groupe.");

  await prisma.conversationParticipant.delete({ where: { id: target.id } });
  leaveUserConversationRoom(targetUserId, conversationId);
  getMessagingIO()?.to(conversationRoom(conversationId)).emit("conversation:updated", { conversationId });
}

// ----------------------------------------------------------------------------
// Pièces jointes — servies UNIQUEMENT via cette fonction (jamais un chemin
// Express `static`, voir le commentaire sur `Message.attachmentUrl` dans
// schema.prisma) : revérifie à CHAQUE téléchargement que l'appelant participe
// bien à la conversation du message visé.
// ----------------------------------------------------------------------------
export async function getAttachmentFile(schoolId: string, messageId: string, meId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || !message.attachmentUrl) throw ApiError.notFound("Pièce jointe introuvable.");

  await getConversationForParticipant(schoolId, message.conversationId, meId);

  const filePath = path.join(process.cwd(), env.MESSAGING_UPLOADS_DIR, message.attachmentUrl);
  if (!fs.existsSync(filePath)) throw ApiError.notFound("Fichier introuvable sur le serveur.");

  return {
    filePath,
    attachmentName: message.attachmentName ?? message.attachmentUrl,
    attachmentType: message.attachmentType ?? "application/octet-stream",
  };
}

// ----------------------------------------------------------------------------
// Présence — fusionne le registre en mémoire (voir presence.ts) et le
// `lastSeenAt` persisté, pour l'affichage INITIAL avant que le premier
// événement socket "presence:update" n'arrive (voir useOnlinePresence côté
// frontend).
// ----------------------------------------------------------------------------
export async function getPresence(userIds: string[]) {
  const online = getOnlineUserIds(userIds);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, lastSeenAt: true },
  });
  return users.map((u) => ({
    userId: u.id,
    online: online.has(u.id),
    lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
  }));
}
