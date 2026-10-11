import { Request, Response } from "express";
import * as adminStatsService from "./admin-stats.service";

export async function getOverview(_req: Request, res: Response) {
  const result = await adminStatsService.getGlobalStats();
  res.json(result);
}
