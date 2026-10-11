import { z } from "zod";
import { ConversationType } from "../../config/prisma";

// Couche "schema" du module Messagerie (itération 45). Voir le commentaire
// d'en-tête de schema.prisma::Conversation pour le cadrage complet
// (`AskUserQuestion` : intégré à SHIONI, ouvert à "tout membre d'une même
// école" — personnel ET parents ET élèves).
//
// Décision explicite (demande utilisateur : "l'envoi et la réception de
// messages... via REST ou via socket, précisez") : TOUTE écriture
// (créer une conversation, envoyer un message, marquer comme lu, ajouter/
// retirer un participant) passe par REST, exactement comme les 44 modules
// précédents de cette application (mutation React Query + axios, protection
// CSRF déjà en place sur `/api` via `csrfProtection`, gestion d'erreur
// centralisée par `errorHandler.ts`). Socket.IO ne sert JAMAIS à persister
// quoi que ce soit : il ne fait que POUSSER vers les clients connectés (1) le
// message qu'une requête REST vient de persister, (2) des signaux 100 %
// éphémères qui n'ont d'ailleurs aucun sens à persister (indicateur de
// saisie, présence en ligne/hors ligne), (3) l'accusé de lecture qu'une
// requête REST vient d'enregistrer. Un seul chemin d'écriture par donnée,
// jamais deux chemins concurrents pour la même mutation — voir
// `messaging.service.ts` et `socket.ts` pour le détail de qui appelle qui.
export const createConversationSchema = z
  .object({
    type: z.nativeEnum(ConversationType),
    // PRIVATE : exactement UN destinataire. GROUP : au moins UN autre membre
    // en plus du créateur (un groupe à un seul membre n'aurait aucun sens).
    participantUserIds: z.array(z.string().uuid()).min(1),
    // Obligatoire pour GROUP (nom du groupe), toujours ignoré pour PRIVATE
    // (voir le `.refine` ci-dessous et le commentaire sur `Conversation.title`
    // dans schema.prisma).
    title: z.string().trim().min(1).max(120).optional(),
  })
  .refine((v) => v.type !== "PRIVATE" || v.participantUserIds.length === 1, {
    message: "Une conversation privée a exactement un destinataire.",
    path: ["participantUserIds"],
  })
  .refine((v) => v.type !== "GROUP" || Boolean(v.title), {
    message: "Un groupe doit avoir un nom.",
    path: ["title"],
  });

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// `before` : curseur de pagination (voir schema.prisma::Message.seq) — le
// `seq` du plus ancien message déjà chargé côté client ; absent pour la
// toute première page (les messages les plus récents). `limit` plafonné
// comme `utils/pagination.ts::MAX_PAGE_SIZE`, mais un contrat VOLONTAIREMENT
// séparé (curseur, pas page/pageSize) — voir le commentaire sur `Message.seq`.
export const listMessagesQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).default(30),
});

export const addParticipantSchema = z.object({
  userId: z.string().uuid(),
});
