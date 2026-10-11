import { Router } from "express";
import * as controller from "./messaging.controller";
import { requireSchoolMemberOrGuardian } from "../../middleware/auth";
import { messagingUpload } from "./messaging.upload";

// Monté sur /schools/:schoolId/messaging (voir schools.routes.ts).
// `authenticate` est déjà posé plus haut sur TOUT le routeur `/schools`
// (voir schools.routes.ts::`router.use(authenticate)`) — inutile de le
// reposer ici.
//
// Garde d'accès UNIQUE pour tout le module, appliquée à CHAQUE route (pas de
// différenciation lecture/écriture par SchoolRole comme les autres modules,
// cadrage `AskUserQuestion` explicite : "tout membre d'une même école" —
// personnel ET parents ET élèves) : `requireSchoolMemberOrGuardian`, déjà
// existante et réutilisée telle quelle (voir middleware/auth.ts). Les
// vérifications plus fines (participer VRAIMENT à CETTE conversation, être
// administrateur d'un groupe pour en gérer les membres) vivent dans
// `messaging.service.ts`, pas ici — elles dépendent de l'id de conversation
// dans l'URL, pas seulement de l'école.
const router = Router({ mergeParams: true });
router.use(requireSchoolMemberOrGuardian);

router.get("/contacts", controller.listContacts);
router.get("/presence", controller.getPresence);

router.get("/conversations", controller.listConversations);
router.post("/conversations", controller.createConversation);
router.get("/conversations/:conversationId", controller.getConversation);

router.get("/conversations/:conversationId/messages", controller.listMessages);
router.post("/conversations/:conversationId/messages", controller.sendMessage);
// Envoi avec pièce jointe — route SÉPARÉE plutôt qu'un seul endpoint
// multipart pour tout (voir messaging.upload.ts) : `messagingUpload.single
// ("file")` (multer) ne wrap que CETTE route précise, pas tout le module.
router.post(
  "/conversations/:conversationId/messages/attachment",
  messagingUpload.single("file"),
  controller.sendMessageWithAttachment
);
router.post("/conversations/:conversationId/read", controller.markRead);

router.post("/conversations/:conversationId/participants", controller.addParticipant);
router.delete("/conversations/:conversationId/participants/:userId", controller.removeParticipant);

// Téléchargement authentifié d'une pièce jointe — voir le commentaire sur
// `Message.attachmentUrl` dans schema.prisma : jamais un chemin `static`.
router.get("/attachments/:messageId", controller.downloadAttachment);

export default router;
