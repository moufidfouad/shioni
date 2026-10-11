import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Depuis Prisma 7, ce fichier remplace la clé "prisma" de package.json et
// le bloc "url" du datasource : c'est ici que le CLI (migrate, studio,
// db seed) sait comment se connecter et où trouver le schéma / les seeds.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
