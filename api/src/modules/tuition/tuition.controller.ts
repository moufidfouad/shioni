import { Request, Response } from "express";
import * as tuitionService from "./tuition.service";
import {
  generateTuitionFeesSchema,
  recordTuitionPaymentSchema,
  tuitionFeeSchema,
  updateTuitionFeeSchema,
} from "./tuition.schema";
import { FeeStatus } from "../../config/prisma";
import { parsePagination } from "../../utils/pagination";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function list(req: Request<{ schoolId: string }>, res: Response) {
  const { schoolYearId, month, status, groupeId, studentId, search } = req.query;
  const pagination = parsePagination(req.query);
  const fees = await tuitionService.listTuitionFees(
    req.params.schoolId,
    {
      schoolYearId: asString(schoolYearId),
      month: asNumber(month),
      status: status === FeeStatus.SOLDE || status === FeeStatus.PARTIEL || status === FeeStatus.IMPAYE ? status : undefined,
      groupeId: asString(groupeId),
      studentId: asString(studentId),
      search: asString(search),
    },
    pagination
  );
  res.json(fees);
}

export async function stats(req: Request<{ schoolId: string }>, res: Response) {
  const result = await tuitionService.getTuitionStats(
    req.params.schoolId,
    asString(req.query.schoolYearId),
    asNumber(req.query.month),
    asString(req.query.groupeId)
  );
  res.json(result);
}

export async function getOne(req: Request<{ schoolId: string; tuitionFeeId: string }>, res: Response) {
  const fee = await tuitionService.getTuitionFee(req.params.schoolId, req.params.tuitionFeeId);
  res.json(fee);
}

export async function create(req: Request<{ schoolId: string }>, res: Response) {
  const input = tuitionFeeSchema.parse(req.body);
  const fee = await tuitionService.createTuitionFee(req.params.schoolId, input);
  res.status(201).json(fee);
}

export async function update(req: Request<{ schoolId: string; tuitionFeeId: string }>, res: Response) {
  const input = updateTuitionFeeSchema.parse(req.body);
  const fee = await tuitionService.updateTuitionFee(req.params.schoolId, req.params.tuitionFeeId, input);
  res.json(fee);
}

export async function recordPayment(req: Request<{ schoolId: string; tuitionFeeId: string }>, res: Response) {
  const input = recordTuitionPaymentSchema.parse(req.body);
  const fee = await tuitionService.recordTuitionPayment(req.params.schoolId, req.params.tuitionFeeId, input);
  res.json(fee);
}

export async function remove(req: Request<{ schoolId: string; tuitionFeeId: string }>, res: Response) {
  await tuitionService.deleteTuitionFee(req.params.schoolId, req.params.tuitionFeeId);
  res.status(204).send();
}

export async function generate(req: Request<{ schoolId: string }>, res: Response) {
  const input = generateTuitionFeesSchema.parse(req.body);
  const result = await tuitionService.generateTuitionFees(req.params.schoolId, input);
  res.status(201).json(result);
}
