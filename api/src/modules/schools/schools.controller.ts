import { Request, Response } from "express";
import * as schoolsService from "./schools.service";
import { schoolSchema, updateSchoolSchema } from "./schools.schema";
import { ApiError } from "../../utils/ApiError";

export async function create(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const input = schoolSchema.parse(req.body);
  const school = await schoolsService.createSchool(req.user.id, input);
  res.status(201).json(school);
}

export async function list(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const schools = await schoolsService.listSchoolsForUser(req.user.id, req.user.isSuperAdmin);
  res.json(schools);
}

export async function getOne(req: Request<{ schoolId: string }>, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const school = await schoolsService.getSchoolById(req.params.schoolId, req.user.id, req.user.isSuperAdmin);
  res.json(school);
}

export async function update(req: Request<{ schoolId: string }>, res: Response) {
  const input = updateSchoolSchema.parse(req.body);
  const school = await schoolsService.updateSchool(req.params.schoolId, input);
  res.json(school);
}

export async function remove(req: Request<{ schoolId: string }>, res: Response) {
  await schoolsService.deleteSchool(req.params.schoolId);
  res.status(204).send();
}

// Itération 64 — logo d'école. `uploadLogo`/`removeLogo` sont gardés ADMIN
// (voir schools.routes.ts, même garde que update/remove) ; `getLogo` suit le
// même accès que `getOne` (requireSchoolMemberOrGuardian).
export async function uploadLogo(req: Request<{ schoolId: string }>, res: Response) {
  if (!req.file) throw ApiError.badRequest("Aucun fichier reçu.");
  const school = await schoolsService.setSchoolLogo(req.params.schoolId, req.file);
  res.json(school);
}

export async function removeLogo(req: Request<{ schoolId: string }>, res: Response) {
  await schoolsService.deleteSchoolLogo(req.params.schoolId);
  res.status(204).send();
}

export async function getLogo(req: Request<{ schoolId: string }>, res: Response) {
  const { filePath, mimeType } = await schoolsService.getSchoolLogoFile(req.params.schoolId);
  res.setHeader("Content-Type", mimeType);
  res.sendFile(filePath);
}
