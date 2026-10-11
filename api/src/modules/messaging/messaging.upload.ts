import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { env } from "../../config/env";

// Dossier de stockage des pièces jointes — jamais servi par un `express.
// static` (voir le commentaire sur `Message.attachmentUrl` dans
// schema.prisma) : uniquement écrit ici par multer, uniquement lu par
// `messaging.service.ts::getAttachmentFile` derrière une vérification
// d'appartenance à la conversation.
const uploadsDir = path.join(process.cwd(), env.MESSAGING_UPLOADS_DIR);
fs.mkdirSync(uploadsDir, { recursive: true });

// Liste blanche volontairement large mais fermée (images usuelles, PDF,
// bureautique courante, archives, texte) plutôt qu'un filtre par extension
// (facilement contourné en renommant un fichier) — un exécutable ou un
// script ne matche aucun de ces types MIME et est rejeté avant même
// d'atteindre le disque.
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/zip",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  // Nom de fichier interne généré côté serveur (jamais le nom d'origine, qui
  // pourrait contenir des caractères dangereux pour un chemin de fichier, ou
  // entrer en collision entre deux envois) — le nom d'origine reste
  // conservé séparément dans `Message.attachmentName` pour l'affichage/le
  // téléchargement.
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const messagingUpload = multer({
  storage,
  limits: { fileSize: env.MESSAGING_MAX_ATTACHMENT_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Type de fichier non autorisé."));
      return;
    }
    cb(null, true);
  },
});
