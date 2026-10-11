import { Request, Response } from "express";
import * as paymentTrackingService from "./payment-tracking.service";
import { paymentTrackingQuerySchema } from "./payment-tracking.schema";
import { parsePagination } from "../../utils/pagination";

export async function list(req: Request<{ schoolId: string }>, res: Response) {
  const query = paymentTrackingQuerySchema.parse(req.query);
  const pagination = parsePagination(req.query);
  const result = await paymentTrackingService.listPaymentTracking(
    req.params.schoolId,
    query,
    pagination,
  );
  res.json(result);
}

export async function stats(req: Request<{ schoolId: string }>, res: Response) {
  const query = paymentTrackingQuerySchema.parse(req.query);
  const result = await paymentTrackingService.getPaymentTrackingStats(
    req.params.schoolId,
    query,
  );
  res.json(result);
}
