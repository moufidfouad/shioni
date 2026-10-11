import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { env } from "../../config/env";


const uploadsDir = path.join(process.cwd(), env.RESOURCES_UPLOADS_DIR);
fs.mkdirSync(uploadsDir, { recursive: true });


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
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  // Nom de fichier interne généré côté serveur (jamais le nom d'origine) —
  // le nom d'origine reste conservé séparément dans `Resource.originalName`
  // pour l'affichage/le téléchargement (voir schema.prisma).
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const resourcesUpload = multer({
  storage,
  limits: { fileSize: env.RESOURCES_MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Type de fichier non autorisé."));
      return;
    }
    cb(null, true);
  },
});
