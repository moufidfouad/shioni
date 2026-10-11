import { randomBytes, timingSafeEqual } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";

// ----------------------------------------------------------------------------
// Protection CSRF — patron "double soumission de cookie"
//
// La session vit dans des cookies httpOnly (voir cookies.ts) : `sameSite:
// "lax"` protège déjà contre la plupart des CSRF cross-site (un POST déclenché
// depuis un autre site n'envoie pas ces cookies), mais pas contre TOUTES les
// requêtes "same-site" ou les navigateurs plus anciens/mal configurés — d'où
// cette couche supplémentaire, explicitement demandée.
//
// Principe : un jeton aléatoire est posé dans un cookie LISIBLE par le
// JavaScript du frontend (contrairement aux cookies de session), et doit être
// renvoyé tel quel dans l'en-tête `X-CSRF-Token` sur toute requête qui modifie
// des données. Un attaquant qui fait exécuter une requête cross-site par la
// victime peut compter sur l'envoi automatique des cookies par le navigateur,
// mais ne peut ni lire le cookie CSRF (origines différentes) ni deviner sa
// valeur pour la reproduire dans l'en-tête — la requête forgée échoue donc
// même si `sameSite` était contourné.
// ----------------------------------------------------------------------------

const CSRF_COOKIE = env.COOKIE_CSRF_NAME;
export const CSRF_HEADER = "x-csrf-token";

// PAS `httpOnly` : c'est tout l'intérêt du patron, le frontend doit pouvoir
// lire ce cookie pour le recopier dans l'en-tête (voir frontend/src/api/
// client.ts). `secure`/`sameSite` suivent exactement la même politique que
// les cookies de session (cookies.ts) pour rester cohérents.
const csrfCookieOptions: CookieOptions = {
  httpOnly: false,
  secure: env.isProd,
  sameSite: "lax",
  path: "/",
};

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

// Pose un jeton CSRF si la requête n'en a pas déjà un (ne le régénère jamais
// inutilement : un jeton qui change à chaque requête invaliderait un onglet
// resté ouvert avec l'ancien jeton en mémoire côté frontend). Appelé tôt dans
// la chaîne de middlewares, sur TOUTES les routes (y compris `/auth/login`,
// qui n'a pas encore de session mais doit déjà être protégée).
export function ensureCsrfCookie(req: Request, res: Response) {
  if (!req.cookies?.[CSRF_COOKIE]) {
    res.cookie(CSRF_COOKIE, generateToken(), csrfCookieOptions);
  }
}

// Comparaison à temps constant (`timingSafeEqual`) plutôt que `===` : évite
// qu'une différence de temps de réponse ne laisse deviner le jeton attendu
// caractère par caractère (même précaution que pour un mot de passe ou un
// token de session ailleurs dans ce projet).
export function isValidCsrfToken(req: Request): boolean {

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (typeof cookieToken !== "string" || typeof headerToken !== "string")
    return false;
  if (cookieToken.length !== headerToken.length) return false;

  return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
}
