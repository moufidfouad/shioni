import type { CookieOptions, Response } from "express";
import { env } from "../config/env";

// Centralise tout ce qui concerne les cookies de session (noms, options,
// durée de vie) : c'est le seul endroit du backend qui doit changer si on
// modifie la stratégie de stockage des tokens. L'authentification passe par
// des cookies **httpOnly** (jamais lisibles par du JS côté navigateur, donc
// pas de localStorage côté frontend) plutôt que par des tokens renvoyés dans
// le corps JSON de la réponse.

const ACCESS_COOKIE = env.COOKIE_ACCESS_NAME;
const REFRESH_COOKIE = env.COOKIE_REFRESH_NAME;

// Convertit une durée façon `jsonwebtoken` ("15m", "7d", "30s"...) en
// millisecondes pour l'attribut `maxAge` du cookie — le même format que
// JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN (voir src/utils/jwt.ts),
// pour que la durée de vie du cookie et celle du token restent synchronisées.
function parseDurationMs(value: string, fallbackMs: number): number {
  const match = value.trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = (match[2] || "ms").toLowerCase();
  const unitToMs: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (unitToMs[unit] ?? 1);
}

const ACCESS_MAX_AGE_MS = parseDurationMs(
  env.JWT_ACCESS_EXPIRES_IN || "15m",
  15 * 60_000,
);
const REFRESH_MAX_AGE_MS = parseDurationMs(
  env.JWT_REFRESH_EXPIRES_IN || "7d",
  7 * 86_400_000,
);

// `secure` n'est activé qu'en production (HTTPS) : en dev, le frontend Vite
// (http://localhost:5173) et le backend (http://localhost:4000) tournent en
// clair. `sameSite: "lax"` suffit tant que frontend et backend restent sur le
// même "site" (même domaine racine, même en dev via le proxy Vite qui rend
// /api same-origin) — si un jour ils sont déployés sur deux domaines
// complètement différents, passer à `sameSite: "none"` (qui impose alors
// `secure: true`, donc HTTPS obligatoire des deux côtés).
const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: "lax",
  path: "/",
};

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_MAX_AGE_MS,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions);
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions);
}

export function getAccessCookie(req: {
  cookies?: Record<string, string>;
}): string | undefined {
  return req.cookies?.[ACCESS_COOKIE];
}

export function getRefreshCookie(req: {
  cookies?: Record<string, string>;
}): string | undefined {
  return req.cookies?.[REFRESH_COOKIE];
}
