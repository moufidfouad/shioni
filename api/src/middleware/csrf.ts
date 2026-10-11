import type { NextFunction, Request, Response } from "express";
import { ensureCsrfCookie, isValidCsrfToken } from "../utils/csrf";

// Méthodes qui modifient des données côté serveur — les seules qu'un CSRF
// classique cherche à forger (un GET ne devrait de toute façon jamais avoir
// d'effet de bord dans cette API).
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  ensureCsrfCookie(req, res);

  if (!UNSAFE_METHODS.has(req.method)) {
    return next();
  }

  if (req.headers.authorization?.startsWith("Bearer ")) {
    return next();
  }

  if (
    req.path === "/v1/mobile/auth/login" ||
    req.path === "/v1/mobile/auth/register"
  ) {
    return next();
  }

  if (!isValidCsrfToken(req)) {
    return res.status(403).json({ error: "Jeton CSRF invalide ou manquant." });
  }

  next();
}
