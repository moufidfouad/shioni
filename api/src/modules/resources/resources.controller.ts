import { Request, Response } from "express";
import * as resourcesService from "./resources.service";
import { ApiError } from "../../utils/ApiError";
import {
  createDocumentResourceSchema,
  createVideoResourceSchema,
  updateResourceSchema,
} from "./resources.schema";

export async function list(req: Request<{ schoolId: string }>, res: Response) {
  const resources = await resourcesService.listResources(req.params.schoolId);
  res.json(resources);
}

export async function getOne(
  req: Request<{ schoolId: string; resourceId: string }>,
  res: Response,
) {
  const resource = await resourcesService.getResource(
    req.params.schoolId,
    req.params.resourceId,
  );
  res.json(resource);
}

// Création d'une ressource VIDEO — corps JSON classique (pas de fichier).
export async function createVideo(
  req: Request<{ schoolId: string }>,
  res: Response,
) {
  if (!req.user) throw ApiError.unauthorized();
  const input = createVideoResourceSchema.parse(req.body);
  const resource = await resourcesService.createVideoResource(
    req.params.schoolId,
    req.user.id,
    input,
  );
  res.status(201).json(resource);
}

// Création d'une ressource DOCUMENT — corps `multipart/form-data`, fichier
// posé par `resourcesUpload.single("file")` (voir resources.routes.ts).
export async function createDocument(
  req: Request<{ schoolId: string }>,
  res: Response,
) {
  if (!req.user) throw ApiError.unauthorized();
  if (!req.file) throw ApiError.badRequest("Aucun fichier reçu.");
  const input = createDocumentResourceSchema.parse(req.body);
  const resource = await resourcesService.createDocumentResource(
    req.params.schoolId,
    req.user.id,
    input,
    req.file,
  );
  res.status(201).json(resource);
}

export async function download(
  req: Request<{ schoolId: string; resourceId: string }>,
  res: Response,
) {
  const { filePath, fileName, mimeType } =
    await resourcesService.getResourceFile(
      req.params.schoolId,
      req.params.resourceId,
    );
  res.setHeader("Content-Type", mimeType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(fileName)}"`,
  );
  res.sendFile(filePath);
}

export async function update(
  req: Request<{ schoolId: string; resourceId: string }>,
  res: Response,
) {
  const input = updateResourceSchema.parse(req.body);
  const resource = await resourcesService.updateResource(
    req.params.schoolId,
    req.params.resourceId,
    input,
  );
  res.json(resource);
}

export async function remove(
  req: Request<{ schoolId: string; resourceId: string }>,
  res: Response,
) {
  await resourcesService.deleteResource(
    req.params.schoolId,
    req.params.resourceId,
  );
  res.status(204).send();
}
