import { Request, Response } from "express";
import * as timetableService from "./timetable.service";
import { timetableEntrySchema, updateTimetableEntrySchema } from "./timetable.schema";
import { resolveTeacherScope } from "../../utils/teacherScope";
import { SchoolRole } from "../../config/prisma";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

// Itération 29 : pas de rôle GESTION_* dédié à l'emploi du temps — seul
// ADMIN garde un accès complet ; un compte ENSEIGNANT (lui seul) est
// restreint à ses propres classes/créneaux.
const fullAccessRoles = [SchoolRole.ADMIN];

export async function list(req: Request<{ schoolId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const { groupeId, day, teacherName, cycleId, classeId, serieId, salleId } = req.query;
  const entries = await timetableService.listTimetable(
    req.params.schoolId,
    {
      groupeId: asString(groupeId),
      day: asString(day),
      teacherName: asString(teacherName),
      // Itération 35 — filtres par structure pédagogique (le plus précis
      // gagne, voir resolveGroupeIds) + par salle.
      cycleId: asString(cycleId),
      classeId: asString(classeId),
      serieId: asString(serieId),
      salleId: asString(salleId),
    },
    scope
  );
  res.json(entries);
}

export async function getOne(req: Request<{ schoolId: string; entryId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const entry = await timetableService.getTimetableEntry(req.params.schoolId, req.params.entryId, scope);
  res.json(entry);
}

export async function create(req: Request<{ schoolId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const input = timetableEntrySchema.parse(req.body);
  const entry = await timetableService.createTimetableEntry(req.params.schoolId, input, scope);
  res.status(201).json(entry);
}

export async function update(req: Request<{ schoolId: string; entryId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const input = updateTimetableEntrySchema.parse(req.body);
  const entry = await timetableService.updateTimetableEntry(req.params.schoolId, req.params.entryId, input, scope);
  res.json(entry);
}

export async function remove(req: Request<{ schoolId: string; entryId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  await timetableService.deleteTimetableEntry(req.params.schoolId, req.params.entryId, scope);
  res.status(204).send();
}
