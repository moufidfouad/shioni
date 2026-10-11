import { Request, Response } from "express";
import * as messagingService from "./messaging.service";
import { addParticipantSchema, createConversationSchema, listMessagesQuerySchema, sendMessageSchema } from "./messaging.schema";
import { ApiError } from "../../utils/ApiError";

// Couche "controller" — même patron que le reste du projet (schema -> service
// -> controller -> routes, voir end-of-year.controller.ts) : Express 5
// transmet automatiquement une promesse rejetée au middleware d'erreur, donc
// pas de try/catch ici. `req.user` est optionnel dans le type `Express.
// Request` (voir types/express.d.ts) : chaque fonction le revérifie avant de
// lire `.id`, exactement comme auth.controller.ts::me/changePassword — même
// si `authenticate` (posé sur tout le routeur, voir messaging.routes.ts)
// garantit déjà sa présence à l'exécution.

export async function listContacts(req: Request<{ schoolId: string }>, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const contacts = await messagingService.listContacts(req.params.schoolId, req.user.id);
  res.json(contacts);
}

export async function listConversations(req: Request<{ schoolId: string }>, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const conversations = await messagingService.listConversations(req.params.schoolId, req.user.id);
  res.json(conversations);
}

export async function createConversation(req: Request<{ schoolId: string }>, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = createConversationSchema.parse(req.body);
  const conversation = await messagingService.createConversation(req.params.schoolId, req.user.id, input);
  res.status(201).json(conversation);
}

export async function getConversation(
  req: Request<{ schoolId: string; conversationId: string }>,
  res: Response
) {
  if (!req.user) throw ApiError.unauthorized();
  const conversation = await messagingService.getConversation(req.params.schoolId, req.params.conversationId, req.user.id);
  res.json(conversation);
}

export async function listMessages(req: Request<{ schoolId: string; conversationId: string }>, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const query = listMessagesQuerySchema.parse(req.query);
  const result = await messagingService.listMessages(req.params.schoolId, req.params.conversationId, req.user.id, query);
  res.json(result);
}

export async function sendMessage(req: Request<{ schoolId: string; conversationId: string }>, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = sendMessageSchema.parse(req.body);
  const message = await messagingService.sendMessage(req.params.schoolId, req.params.conversationId, req.user.id, {
    content: input.content,
  });
  res.status(201).json(message);
}

export async function sendMessageWithAttachment(
  req: Request<{ schoolId: string; conversationId: string }>,
  res: Response
) {
  if (!req.user) throw ApiError.unauthorized();
  const file = req.file;
  if (!file) throw ApiError.badRequest("Aucun fichier reçu.");
  // `content` optionnel — un fichier envoyé en `multipart/form-data` porte
  // ses champs texte à côté (`req.body`, peuplé par multer même pour les
  // champs non-fichier), pas de schéma zod distinct nécessaire pour un seul
  // champ optionnel court.
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : undefined;

  const message = await messagingService.sendMessage(req.params.schoolId, req.params.conversationId, req.user.id, {
    content: content || undefined,
    attachment: {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    },
  });
  res.status(201).json(message);
}

export async function markRead(req: Request<{ schoolId: string; conversationId: string }>, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await messagingService.markConversationRead(req.params.schoolId, req.params.conversationId, req.user.id);
  res.status(204).send();
}

export async function addParticipant(req: Request<{ schoolId: string; conversationId: string }>, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = addParticipantSchema.parse(req.body);
  const conversation = await messagingService.addParticipant(
    req.params.schoolId,
    req.params.conversationId,
    req.user.id,
    input.userId
  );
  res.status(201).json(conversation);
}

export async function removeParticipant(
  req: Request<{ schoolId: string; conversationId: string; userId: string }>,
  res: Response
) {
  if (!req.user) throw ApiError.unauthorized();
  await messagingService.removeParticipant(req.params.schoolId, req.params.conversationId, req.user.id, req.params.userId);
  res.status(204).send();
}

export async function downloadAttachment(req: Request<{ schoolId: string; messageId: string }>, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const { filePath, attachmentName, attachmentType } = await messagingService.getAttachmentFile(
    req.params.schoolId,
    req.params.messageId,
    req.user.id
  );
  res.setHeader("Content-Type", attachmentType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(attachmentName)}"`);
  res.sendFile(filePath);
}

export async function getPresence(req: Request<{ schoolId: string }>, res: Response) {
  const raw = typeof req.query.userIds === "string" ? req.query.userIds : "";
  const userIds = raw.split(",").map((id) => id.trim()).filter(Boolean);
  if (userIds.length === 0) return res.json([]);
  const presence = await messagingService.getPresence(userIds);
  res.json(presence);
}
