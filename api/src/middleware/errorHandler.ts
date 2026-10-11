import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { ApiError } from "../utils/ApiError";
import { isProd } from "../config/env";

// Middleware d'erreur centralisé : place-le en DERNIER dans app.ts.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }

  // Erreurs de contrainte unique Prisma (ex: email déjà utilisé)
  if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
    return res.status(409).json({ error: "Cette ressource existe déjà (contrainte unique violée)." });
  }

  // Validation Zod non interceptée par un `.parse()` déjà entouré d'un
  // ApiError.badRequest ailleurs : on la traduit ici en 400 plutôt que de la
  // laisser tomber dans le 500 générique ci-dessous.
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation échouée", details: err.flatten() });
  }

  // Itération 45 — pièces jointes de la messagerie ; itération 64 — photos
  // d'identité/logo d'école (modules/*/[...]upload.ts, resources.upload.ts,
  // middleware/imageUpload.ts — tous les consommateurs de multer de ce
  // projet) : une erreur multer (fichier trop volumineux, type non
  // autorisé) ne doit jamais retomber dans le 500 générique ci-dessous,
  // c'est toujours une erreur de la REQUÊTE (400), jamais du serveur.
  // `startsWith` plutôt qu'une égalité stricte : chaque module personnalise
  // légèrement ce message ("... (image uniquement)." pour imageUpload.ts)
  // sans avoir à répéter cette liste ici à chaque nouvel upload.
  if (err instanceof multer.MulterError || (err instanceof Error && err.message.startsWith("Type de fichier non autorisé"))) {
    return res.status(400).json({ error: err.message });
  }

  console.error(err);
  // En production, ne jamais renvoyer le détail de l'erreur (message/stack)
  // au client : ça peut fuiter des informations internes (chemins, requêtes
  // SQL, versions de dépendances...). En dev, on le garde pour faciliter le
  // débogage.
  return res.status(500).json({
    error: "Erreur interne du serveur.",
    ...(isProd ? {} : { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined }),
  });
}
