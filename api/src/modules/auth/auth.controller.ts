import { Request, Response } from "express";
import * as authService from "./auth.service";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from "./auth.schema";
import { ApiError } from "../../utils/ApiError";
import {
  clearAuthCookies,
  getRefreshCookie,
  setAuthCookies,
} from "../../utils/cookies";

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const { user, accessToken, refreshToken } = await authService.register(input);
  setAuthCookies(res, { accessToken, refreshToken });
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const { user, accessToken, refreshToken } = await authService.login(
    input.identifier,
    input.password,
  );
  setAuthCookies(res, { accessToken, refreshToken });
  res.json({ user });
}

export async function refresh(req: Request, res: Response) {
  const refreshToken = getRefreshCookie(req);
  if (!refreshToken) throw ApiError.unauthorized("Refresh token manquant.");

  const result = await authService.refresh(refreshToken);
  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
  res.json({ user: result.user });
}

export async function logout(req: Request, res: Response) {
  const refreshToken = getRefreshCookie(req);
  if (refreshToken) await authService.logout(refreshToken);
  clearAuthCookies(res);
  res.status(204).send();
}

export async function me(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const result = await authService.me(req.user.id);
  res.json(result);
}

export async function changePassword(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = changePasswordSchema.parse(req.body);
  await authService.changePassword(req.user.id, input);
  res.status(204).send();
}
