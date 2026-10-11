import { Request, Response } from "express";
import * as endOfYearService from "./end-of-year.service";
import { endOfYearDecisionSchema } from "./end-of-year.schema";
import { EndOfYearDecisionType, SchoolRole } from "../../config/prisma";
import { parsePagination } from "../../utils/pagination";
import { resolveTeacherScope } from "../../utils/teacherScope";
import { ApiError } from "../../utils/ApiError";

// Mêmes rôles à accès complet en LECTURE que ceux autorisés en ÉCRITURE
// (ADMIN, GESTION_ELEVES — voir end-of-year.routes.ts) : pas GESTION_NOTES,
// une décision de fin d'année s'appuie sur les notes mais reste une décision
// d'affectation d'élève, pas une décision pédagogique de notation (voir
// "Décisions prises", choix (4)). Un compte ENSEIGNANT scopé garde un accès
// en LECTURE à ses propres classes (même principe que le bulletin/
// classement, itération 29), jamais en écriture ici (à la différence de
// Notes/Présences/Emploi du temps).
const fullAccessRoles = [SchoolRole.ADMIN, SchoolRole.GESTION_ELEVES];

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asDecision(v: unknown): EndOfYearDecisionType | undefined {
  return typeof v === "string" && (Object.values(EndOfYearDecisionType) as string[]).includes(v)
    ? (v as EndOfYearDecisionType)
    : undefined;
}

export async function overview(req: Request<{ schoolId: string }>, res: Response) {
  const groupeId = asString(req.query.groupeId);
  const schoolYearId = asString(req.query.schoolYearId);
  if (!groupeId || !schoolYearId) throw ApiError.badRequest("Choisissez une classe et une année scolaire.");

  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const rows = await endOfYearService.getOverview(req.params.schoolId, groupeId, schoolYearId, scope);
  res.json(rows);
}

export async function stats(req: Request<{ schoolId: string }>, res: Response) {
  const schoolYearId = asString(req.query.schoolYearId);
  if (!schoolYearId) throw ApiError.badRequest("Choisissez une année scolaire.");
  const result = await endOfYearService.getStats(req.params.schoolId, schoolYearId, asString(req.query.groupeId));
  res.json(result);
}

export async function list(req: Request<{ schoolId: string }>, res: Response) {
  const { schoolYearId, decision, groupeId, search } = req.query;
  const pagination = parsePagination(req.query);
  const result = await endOfYearService.listDecisions(
    req.params.schoolId,
    {
      schoolYearId: asString(schoolYearId),
      decision: asDecision(decision),
      groupeId: asString(groupeId),
      search: asString(search),
    },
    pagination
  );
  res.json(result);
}

export async function getOne(req: Request<{ schoolId: string; decisionId: string }>, res: Response) {
  const decision = await endOfYearService.getDecision(req.params.schoolId, req.params.decisionId);
  res.json(decision);
}

export async function upsert(req: Request<{ schoolId: string }>, res: Response) {
  const input = endOfYearDecisionSchema.parse(req.body);
  const decision = await endOfYearService.upsertDecision(req.params.schoolId, input);
  res.status(201).json(decision);
}

export async function remove(req: Request<{ schoolId: string; decisionId: string }>, res: Response) {
  await endOfYearService.deleteDecision(req.params.schoolId, req.params.decisionId);
  res.status(204).send();
}
