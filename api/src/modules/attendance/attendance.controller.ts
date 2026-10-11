import { Request, Response } from "express";
import * as attendanceService from "./attendance.service";
import { attendanceSchema, bulkAttendanceSchema, updateAttendanceSchema } from "./attendance.schema";
import { AttendanceStatus, SchoolRole } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { resolveTeacherScope } from "../../utils/teacherScope";
import { parsePagination } from "../../utils/pagination";


const fullAccessRoles = [SchoolRole.ADMIN, SchoolRole.GESTION_ELEVES];

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asStatus(v: unknown): AttendanceStatus | undefined {
  const s = asString(v);
  if (!s) return undefined;
  return (Object.values(AttendanceStatus) as string[]).includes(s) ? (s as AttendanceStatus) : undefined;
}

export async function list(req: Request<{ schoolId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const { groupeId, studentId, status, dateFrom, dateTo, cycleId, classeId, serieId } = req.query;
  const pagination = parsePagination(req.query);
  const records = await attendanceService.listAttendance(
    req.params.schoolId,
    {
      groupeId: asString(groupeId),
      studentId: asString(studentId),
      status: asStatus(status),
      dateFrom: asString(dateFrom),
      dateTo: asString(dateTo),
      // Itération 35 — filtres par structure pédagogique.
      cycleId: asString(cycleId),
      classeId: asString(classeId),
      serieId: asString(serieId),
    },
    scope,
    pagination
  );
  res.json(records);
}

export async function stats(req: Request<{ schoolId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const groupeId = asString(req.query.groupeId);
  if (!groupeId) throw ApiError.badRequest("groupeId est requis.");
  const result = await attendanceService.getAttendanceStats(
    req.params.schoolId,
    groupeId,
    asString(req.query.dateFrom),
    asString(req.query.dateTo),
    scope
  );
  res.json(result);
}

export async function getOne(req: Request<{ schoolId: string; attendanceId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const record = await attendanceService.getAttendance(req.params.schoolId, req.params.attendanceId, scope);
  res.json(record);
}

export async function create(req: Request<{ schoolId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const input = attendanceSchema.parse(req.body);
  const record = await attendanceService.createAttendance(req.params.schoolId, input, scope);
  res.status(201).json(record);
}

export async function update(req: Request<{ schoolId: string; attendanceId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const input = updateAttendanceSchema.parse(req.body);
  const record = await attendanceService.updateAttendance(req.params.schoolId, req.params.attendanceId, input, scope);
  res.json(record);
}

export async function bulkSet(req: Request<{ schoolId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const input = bulkAttendanceSchema.parse(req.body);
  const records = await attendanceService.bulkSetAttendance(req.params.schoolId, input, scope);
  res.status(201).json(records);
}

export async function remove(req: Request<{ schoolId: string; attendanceId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  await attendanceService.deleteAttendance(req.params.schoolId, req.params.attendanceId, scope);
  res.status(204).send();
}
