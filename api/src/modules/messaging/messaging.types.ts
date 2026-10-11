// Formes de réponse partagées du module Messagerie — utilisées à la fois par
// `messaging.service.ts` (qui les construit) et `socket.ts` (qui les diffuse
// telles quelles aux clients connectés, voir `ServerToClientEvents`) : un seul
// endroit décrit "à quoi ressemble un message/une conversation sur le fil",
// plutôt que deux formes qui pourraient dériver l'une de l'autre avec le temps.

export interface MessageDTO {
  id: string;
  conversationId: string;
  seq: number;
  senderId: string;
  sender: { id: string; fullName: string };
  content: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
  // `true` seulement si `attachmentUrl` est renseigné côté base — le nom de
  // fichier interne lui-même n'est JAMAIS renvoyé au client (voir le
  // commentaire sur `Message.attachmentUrl` dans schema.prisma) : le
  // téléchargement passe uniquement par `GET .../attachments/:messageId`,
  // qui revérifie l'appartenance à la conversation à chaque appel.
  hasAttachment: boolean;
  createdAt: string;
}

export interface ConversationParticipantDTO {
  userId: string;
  fullName: string;
  role: "MEMBER" | "ADMIN";
}

export interface ConversationSummaryDTO {
  id: string;
  type: "PRIVATE" | "GROUP";
  // Nom affiché : `title` pour un groupe, nom de l'AUTRE participant pour une
  // conversation privée (calculé côté serveur — voir
  // messaging.service.ts::toConversationSummary — pour ne jamais faire
  // porter cette logique par chaque écran du frontend).
  displayName: string;
  participants: ConversationParticipantDTO[];
  myRole: "MEMBER" | "ADMIN";
  lastMessage: MessageDTO | null;
  unreadCount: number;
  updatedAt: string;
}
