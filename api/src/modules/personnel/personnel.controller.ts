import { Request, Response } from "express";
import * as personnelService from "./personnel.service";
import { staffSchema, updateStaffSchema } from "./personnel.schema";
import { parsePagination } from "../../utils/pagination";
import { ApiError } from "../../utils/ApiError";

export async function list(req: Request<{ schoolId: string }>, res: Response) {
  const { search, fonction, statut } = req.query;
  const pagination = parsePagination(req.query);
  const staff = await personnelService.listStaff(
    req.params.schoolId,
    {
      search: typeof search === "string" ? search : undefined,
      fonction: typeof fonction === "string" ? fonction : undefined,
      statut: typeof statut === "string" ? statut : undefined,
    },
    pagination,
  );
  res.json(staff);
}

export async function stats(req: Request<{ schoolId: string }>, res: Response) {
  const result = await personnelService.getStaffStats(req.params.schoolId);
  res.json(result);
}

export async function getOne(
  req: Request<{ schoolId: string; staffId: string }>,
  res: Response,
) {
  const staff = await personnelService.getStaffMember(
    req.params.schoolId,
    req.params.staffId,
  );
  res.json(staff);
}

export async function create(
  req: Request<{ schoolId: string }>,
  res: Response,
) {
  const input = staffSchema.parse(req.body);
  const staff = await personnelService.createStaff(req.params.schoolId, input);
  res.status(201).json(staff);
}

export async function update(
  req: Request<{ schoolId: string; staffId: string }>,
  res: Response,
) {
  const input = updateStaffSchema.parse(req.body);
  const staff = await personnelService.updateStaff(
    req.params.schoolId,
    req.params.staffId,
    input,
  );
  res.json(staff);
}

export async function remove(
  req: Request<{ schoolId: string; staffId: string }>,
  res: Response,
) {
  await personnelService.deleteStaff(req.params.schoolId, req.params.staffId);
  res.status(204).send();
}

// Itération 64 — photo d'identité personnel. Tout ce module est déjà gardé
// ADMIN-only par le router (cf. personnel.routes.ts) — aucune vérification
// de rôle supplémentaire nécessaire ici.
export async function uploadPhoto(
  req: Request<{ schoolId: string; staffId: string }>,
  res: Response,
) {
  if (!req.file) throw ApiError.badRequest("Aucun fichier reçu.");
  const staff = await personnelService.setStaffPhoto(
    req.params.schoolId,
    req.params.staffId,
    req.file,
  );
  res.json(staff);
}

export async function removePhoto(
  req: Request<{ schoolId: string; staffId: string }>,
  res: Response,
) {
  await personnelService.deleteStaffPhoto(
    req.params.schoolId,
    req.params.staffId,
  );
  res.status(204).send();
}

export async function getPhoto(
  req: Request<{ schoolId: string; staffId: string }>,
  res: Response,
) {
  const { filePath, mimeType } = await personnelService.getStaffPhotoFile(
    req.params.schoolId,
    req.params.staffId,
  );
  res.setHeader("Content-Type", mimeType);
  res.sendFile(filePath);
}
