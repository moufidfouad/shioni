import { Request, Response } from "express";

import * as authService from "../../auth/auth.service";
import { loginSchema, registerSchema } from "../../auth/auth.schema";
import { mobileRefreshSchema } from "./mobile-auth.schema";

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const { user, accessToken, refreshToken } = await authService.register(input);
  res.status(201).json({ user, accessToken, refreshToken });
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const { user, accessToken, refreshToken } = await authService.login(
    input.identifier,
    input.password,
  );
  res.json({ user, accessToken, refreshToken });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = mobileRefreshSchema.parse(req.body);
  const result = await authService.refresh(refreshToken);
  res.json({
    user: result.user,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) await authService.logout(refreshToken);
  res.status(204).send();
}
