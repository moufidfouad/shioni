import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string; // userId
  isSuperAdmin: boolean;
}

// Les secrets viennent du module central `config/env` : en production, leur
// absence fait échouer le démarrage au lieu de retomber silencieusement sur
// une valeur par défaut publiquement connue (voir config/env.ts).
const ACCESS_SECRET = env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES_IN = env.JWT_ACCESS_EXPIRES_IN;
const REFRESH_EXPIRES_IN = env.JWT_REFRESH_EXPIRES_IN;

// Les valeurs viennent de variables d'environnement (donc typées `string`
// par TS), alors que @types/jsonwebtoken attend un littéral du type
// `StringValue` (ex "15m") pour `expiresIn` : on caste volontairement les
// options plutôt que de figer le type de ACCESS_EXPIRES_IN.
export const signAccessToken = (payload: AccessTokenPayload) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN } as jwt.SignOptions);

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload & { iat: number; exp: number };

export const signRefreshToken = (userId: string) =>
  jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN } as jwt.SignOptions);

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, REFRESH_SECRET) as { sub: string; iat: number; exp: number };

export const refreshTokenExpiryDate = () => {
  const days = Number((REFRESH_EXPIRES_IN.match(/\d+/) || ["7"])[0]);
  const date = new Date();
  date.setDate(date.getDate() + (Number.isFinite(days) ? days : 7));
  return date;
};
