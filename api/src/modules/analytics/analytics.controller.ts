import { Request, Response } from "express";
import * as analyticsService from "./analytics.service";

export async function getOverview(
  req: Request<{ schoolId: string }>,
  res: Response,
) {
  const result = await analyticsService.getAnalyticsOverview(
    req.params.schoolId,
  );
  res.json(result);
}
