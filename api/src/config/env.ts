import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),

  SUPERADMIN_EMAIL: z.string().email().min(1, "SUPERADMIN_EMAIL est requis"),
  SUPERADMIN_PASSWORD: z.string().min(1, "SUPERADMIN_PASSWORD est requis"),

  COOKIE_ACCESS_NAME: z.string().min(10),
  COOKIE_REFRESH_NAME: z.string().min(10),
  COOKIE_CSRF_NAME: z.string().min(10),

  JWT_ACCESS_SECRET: z.string().min(10),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  PORT: z.coerce.number().default(4000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  isProd: z.boolean().default(process.env.NODE_ENV === "production"),
  BACKEND_URL: z
    .string()
    .default(`http://localhost:${process.env.PORT || 4000}`),
  API_V1_URL: z.string().default("api"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  EXTRA_CORS_ORIGINS: z.string().optional(),
  // Répertoire de stockage des fichiers uploadés (logos d'entreprise...), servi
  // statiquement sous /uploads. Chemin relatif au répertoire de travail du process.
  UPLOADS_DIR: z.string().default("uploads"),
  // URL publique du frontend — utilisée pour construire les liens dans les emails
  // (vérification, réinitialisation de mot de passe).
  FRONTEND_URL: z.string().default("http://localhost:5173"),

  MESSAGING_UPLOADS_DIR: z.string().default("uploads/messaging"),
  MESSAGING_MAX_ATTACHMENT_MB: z.coerce.number().default(10),

  RESOURCES_UPLOADS_DIR: z.string().default("uploads/resources"),
  RESOURCES_MAX_FILE_MB: z.coerce.number().default(25),

  PHOTOS_UPLOADS_DIR: z.string().default("uploads/photos"),
  PHOTOS_MAX_FILE_MB: z.coerce.number().default(5),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Variables d'environnement invalides :",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
