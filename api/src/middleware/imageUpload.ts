import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { env } from "../config/env";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function makeImageUpload(subDir: string) {
  const uploadsDir = path.join(process.cwd(), env.PHOTOS_UPLOADS_DIR, subDir);
  fs.mkdirSync(uploadsDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    // Nom de fichier interne généré côté serveur (jamais le nom d'origine) —
    // contrairement à `Resource`, une photo d'identité n'a pas besoin de
    // conserver son nom d'origine (jamais "téléchargée" par titre, toujours
    // affichée inline).
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 10);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: env.PHOTOS_MAX_FILE_MB * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(new Error("Type de fichier non autorisé (image uniquement)."));
        return;
      }
      cb(null, true);
    },
  });
}

export const studentPhotoUpload = makeImageUpload("students");
export const staffPhotoUpload = makeImageUpload("staff");
export const schoolLogoUpload = makeImageUpload("schools");
