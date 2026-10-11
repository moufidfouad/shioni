import { Request, Response } from "express";
import * as pushTokensService from "./push-tokens.service";
import { registerPushTokenSchema, unregisterPushTokenSchema } from "./push-tokens.schema";
import { ApiError } from "../../utils/ApiError";

export async function register(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = registerPushTokenSchema.parse(req.body);
  await pushTokensService.registerToken(req.user.id, input.token, input.platform);
  res.status(204).send();
}

export async function unregister(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = unregisterPushTokenSchema.parse(req.body);
  await pushTokensService.unregisterToken(req.user.id, input.token);
  res.status(204).send();
}
