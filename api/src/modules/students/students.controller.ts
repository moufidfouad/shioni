import { Request, Response } from "express";
import * as studentsService from "./students.service";
import { studentSchema, updateStudentSchema } from "./students.schema";
import { Sex, SchoolRole } from "../../config/prisma";
import { resolveTeacherScope } from "../../utils/teacherScope";
import { parsePagination } from "../../utils/pagination";
import { ApiError } from "../../utils/ApiError";


const fullAccessRoles = [SchoolRole.ADMIN, SchoolRole.GESTION_ELEVES];

export async function list(req: Request<{ schoolId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const { groupeId, sex, search, cycleId, classeId, serieId } = req.query;
  const pagination = parsePagination(req.query);
  const students = await studentsService.listStudents(
    req.params.schoolId,
    {
      groupeId: typeof groupeId === "string" ? groupeId : undefined,
      sex: sex === "M" || sex === "F" ? (sex as Sex) : undefined,
      search: typeof search === "string" ? search : undefined,
      // Itération 35 — filtres par structure pédagogique.
      cycleId: typeof cycleId === "string" ? cycleId : undefined,
      classeId: typeof classeId === "string" ? classeId : undefined,
      serieId: typeof serieId === "string" ? serieId : undefined,
    },
    scope,
    pagination
  );
  res.json(students);
}

export async function stats(req: Request<{ schoolId: string }>, res: Response) {
  const result = await studentsService.getStudentStats(req.params.schoolId);
  res.json(result);
}

export async function getOne(req: Request<{ schoolId: string; studentId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const student = await studentsService.getStudent(req.params.schoolId, req.params.studentId, scope);
  res.json(student);
}

export async function create(req: Request<{ schoolId: string }>, res: Response) {
  const input = studentSchema.parse(req.body);
  const student = await studentsService.createStudent(req.params.schoolId, input);
  res.status(201).json(student);
}

export async function update(req: Request<{ schoolId: string; studentId: string }>, res: Response) {
  const input = updateStudentSchema.parse(req.body);
  const student = await studentsService.updateStudent(req.params.schoolId, req.params.studentId, input);
  res.json(student);
}

export async function remove(req: Request<{ schoolId: string; studentId: string }>, res: Response) {
  await studentsService.deleteStudent(req.params.schoolId, req.params.studentId);
  res.status(204).send();
}

export async function uploadPhoto(req: Request<{ schoolId: string; studentId: string }>, res: Response) {
  if (!req.file) throw ApiError.badRequest("Aucun fichier reçu.");
  const student = await studentsService.setStudentPhoto(req.params.schoolId, req.params.studentId, req.file);
  res.json(student);
}

export async function removePhoto(req: Request<{ schoolId: string; studentId: string }>, res: Response) {
  await studentsService.deleteStudentPhoto(req.params.schoolId, req.params.studentId);
  res.status(204).send();
}

export async function getPhoto(req: Request<{ schoolId: string; studentId: string }>, res: Response) {
  const scope = await resolveTeacherScope(req, req.params.schoolId, fullAccessRoles);
  const { filePath, mimeType } = await studentsService.getStudentPhotoFile(req.params.schoolId, req.params.studentId, scope);
  res.setHeader("Content-Type", mimeType);
  res.sendFile(filePath);
}
