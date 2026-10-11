import { Request, Response } from "express";
import * as dashboardService from "./dashboard.service";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export async function getOne(req: Request<{ schoolId: string }>, res: Response) {
  const result = await dashboardService.getDashboard(req.params.schoolId, asString(req.query.schoolYearId));
  res.json(result);
}
