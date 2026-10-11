import { Request, Response } from "express";
import * as service from "./admin-contact-messages.service";

export async function list(_req: Request, res: Response) {
  const messages = await service.listContactMessages();
  res.json(messages);
}
