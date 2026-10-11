import { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import * as service from "./parent-portal.service";

// Même convention que grades.controller.ts (asInt/requireInt) : un
// `trimestre` absent est un filtre optionnel valide, mais un `trimestre`
// PRÉSENT et invalide (non entier, ou hors 1-3 — les seules valeurs valides
// dans cette appli, voir grades.schema.ts) doit renvoyer un 400 plutôt que
// de laisser passer un `NaN` jusqu'à la couche service.
function parseTrimestre(raw: unknown): number | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 3) {
    throw ApiError.badRequest("trimestre doit être un entier entre 1 et 3.");
  }
  return n;
}

export async function listChildren(req: Request<{ schoolId: string }>, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const children = await service.listMyChildren(req.user.id, req.params.schoolId);
  res.json(children);
}

export async function getChildSummary(
  req: Request<{ schoolId: string; studentId: string }>,
  res: Response
) {
  if (!req.user) throw ApiError.unauthorized();
  const trimestre = parseTrimestre(req.query.trimestre);
  const schoolYearId = typeof req.query.schoolYearId === "string" ? req.query.schoolYearId : undefined;

  const summary = await service.getChildSummary(req.user.id, req.params.schoolId, req.params.studentId, {
    trimestre,
    schoolYearId,
  });
  res.json(summary);
}

// Itération 72 — Phase 2b mobile.
export async function getChildTimetable(
  req: Request<{ schoolId: string; studentId: string }>,
  res: Response
) {
  if (!req.user) throw ApiError.unauthorized();
  const entries = await service.getChildTimetable(req.user.id, req.params.schoolId, req.params.studentId);
  res.json(entries);
}
