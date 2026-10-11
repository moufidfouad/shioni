import { Request, Response } from "express";
import * as gradesService from "./grades.service";
import { bulkGradeEvaluationSchema, deleteEvaluationSchema, gradeSchema, updateGradeSchema } from "./grades.schema";
import { ApiError } from "../../utils/ApiError";
import { resolveTeacherScope } from "../../utils/teacherScope";
import { parsePagination } from "../../utils/pagination";
import { SchoolRole } from "../../config/prisma";

// Itération 29 : un compte ENSEIGNANT (et lui seul — ADMIN/GESTION_NOTES
// gardent un accès complet, cf. resolveTeacherScope) est restreint à ses
// propres classes/matières sur tout ce module.
const fullAccessRoles = [SchoolRole.ADMIN, SchoolRole.GESTION_NOTES];

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asInt(v: unknown): number | undefined {
  const s = asString(v);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isInteger(n) ? n : undefined;
}

function requireInt(v: unknown, label: string): number {
  const n = asInt(v);
  if (n === undefined) throw ApiError.badRequest(`${label} est requis et doit être un entier.`);
  return n;
}

function requireString(v: unknown, label: string): string {
  const s = asString(v);
  if (!s) throw ApiError.badRequest(`${label} est requis.`);
  return s;
}

export async function list(req: Request<{ schoolId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const { groupeId, subjectId, trimestre, studentId, cycleId, classeId, serieId } = req.query;
  const pagination = parsePagination(req.query);
  const grades = await gradesService.listGrades(
    req.params.schoolId,
    {
      groupeId: asString(groupeId),
      subjectId: asString(subjectId),
      trimestre: asInt(trimestre),
      studentId: asString(studentId),
      // Itération 35 — filtres par structure pédagogique.
      cycleId: asString(cycleId),
      classeId: asString(classeId),
      serieId: asString(serieId),
    },
    scope,
    pagination
  );
  res.json(grades);
}

export async function ranking(req: Request<{ schoolId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const groupeId = asString(req.query.groupeId);
  if (!groupeId) throw ApiError.badRequest("groupeId est requis.");
  const trimestre = requireInt(req.query.trimestre, "trimestre");
  const rows = await gradesService.getClassRanking(req.params.schoolId, groupeId, trimestre, scope);
  res.json(rows);
}

export async function bulletin(req: Request<{ schoolId: string; studentId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const trimestre = requireInt(req.query.trimestre, "trimestre");
  const result = await gradesService.getStudentBulletin(req.params.schoolId, req.params.studentId, trimestre, scope);
  res.json(result);
}

export async function getOne(req: Request<{ schoolId: string; gradeId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const grade = await gradesService.getGrade(req.params.schoolId, req.params.gradeId, scope);
  res.json(grade);
}

export async function create(req: Request<{ schoolId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const input = gradeSchema.parse(req.body);
  const grade = await gradesService.createGrade(req.params.schoolId, input, scope);
  res.status(201).json(grade);
}

export async function update(req: Request<{ schoolId: string; gradeId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const input = updateGradeSchema.parse(req.body);
  const grade = await gradesService.updateGrade(req.params.schoolId, req.params.gradeId, input, scope);
  res.json(grade);
}

export async function bulkSet(req: Request<{ schoolId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const input = bulkGradeEvaluationSchema.parse(req.body);
  const result = await gradesService.bulkSetGradeEvaluation(req.params.schoolId, input, scope);
  res.status(201).json(result);
}

// DELETE avec les critères en query string (groupeId/subjectId/trimestre/
// label) plutôt qu'un corps de requête — plus conventionnel pour une
// méthode DELETE, et évite toute ambiguïté avec certains clients HTTP qui
// gèrent mal un corps sur cette méthode.
export async function deleteEvaluation(req: Request<{ schoolId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const input = deleteEvaluationSchema.parse({
    groupeId: requireString(req.query.groupeId, "groupeId"),
    subjectId: requireString(req.query.subjectId, "subjectId"),
    trimestre: requireInt(req.query.trimestre, "trimestre"),
    label: requireString(req.query.label, "label"),
  });
  await gradesService.deleteEvaluationForClass(req.params.schoolId, input, scope);
  res.status(204).send();
}

export async function remove(req: Request<{ schoolId: string; gradeId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  await gradesService.deleteGrade(req.params.schoolId, req.params.gradeId, scope);
  res.status(204).send();
}
