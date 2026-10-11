import { Request, Response } from "express";
import * as financeService from "./finance.service";
import { financeEntrySchema, updateFinanceEntrySchema } from "./finance.schema";
import { FinanceEntryType } from "../../config/prisma";
import { parsePagination } from "../../utils/pagination";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  const s = asString(v);
  if (!s || s.trim() === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function asType(v: unknown): FinanceEntryType | undefined {
  const s = asString(v);
  if (!s) return undefined;
  return (Object.values(FinanceEntryType) as string[]).includes(s) ? (s as FinanceEntryType) : undefined;
}

export async function list(req: Request<{ schoolId: string }>, res: Response) {
  const { year, month, type } = req.query;
  const pagination = parsePagination(req.query);
  const entries = await financeService.listFinanceEntries(
    req.params.schoolId,
    {
      year: asNumber(year),
      month: asNumber(month),
      type: asType(type),
    },
    pagination
  );
  res.json(entries);
}

export async function stats(req: Request<{ schoolId: string }>, res: Response) {
  const result = await financeService.getFinanceStats(
    req.params.schoolId,
    asNumber(req.query.year),
    asNumber(req.query.month)
  );
  res.json(result);
}

export async function monthly(req: Request<{ schoolId: string }>, res: Response) {
  const year = asNumber(req.query.year) ?? new Date().getFullYear();
  const result = await financeService.getMonthlyFinanceSummary(req.params.schoolId, year);
  res.json(result);
}

export async function getOne(req: Request<{ schoolId: string; entryId: string }>, res: Response) {
  const entry = await financeService.getFinanceEntry(req.params.schoolId, req.params.entryId);
  res.json(entry);
}

export async function create(req: Request<{ schoolId: string }>, res: Response) {
  const input = financeEntrySchema.parse(req.body);
  const entry = await financeService.createFinanceEntry(req.params.schoolId, input);
  res.status(201).json(entry);
}

export async function update(req: Request<{ schoolId: string; entryId: string }>, res: Response) {
  const input = updateFinanceEntrySchema.parse(req.body);
  const entry = await financeService.updateFinanceEntry(req.params.schoolId, req.params.entryId, input);
  res.json(entry);
}

export async function remove(req: Request<{ schoolId: string; entryId: string }>, res: Response) {
  await financeService.deleteFinanceEntry(req.params.schoolId, req.params.entryId);
  res.status(204).send();
}
