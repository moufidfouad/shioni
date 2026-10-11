import { Request, Response } from "express";
import * as publicResourcesService from "./publicResources.service";
import { ResourceType } from "../../config/prisma";
import { parsePagination } from "../../utils/pagination";

// Itération 50 — "permettre les select multiple" : chaque dimension de
// filtre arrive désormais en CSV (`?classeIds=id1,id2`), pas en tableau
// JSON/`?classeIds[]=id1&classeIds[]=id2` — ce dernier format dépend du
// query parser Express configuré ("extended" via `qs`, vs "simple"/
// `querystring` par défaut en Express 5, qui ne le comprend pas), alors
// qu'une simple chaîne CSV fonctionne à l'identique quel que soit le query
// parser. Cohérent avec la convention déjà établie de ce module : pas de
// zod sur les query params GET, seulement un narrowing `typeof === "string"`
// (voir `students.controller.ts` pour le précédent).
function parseCsvIds(value: unknown): string[] | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const ids = value.split(",").filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

function parseTypes(value: unknown): ResourceType[] | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const types = value.split(",").filter((t): t is ResourceType => t === "DOCUMENT" || t === "VIDEO");
  return types.length > 0 ? types : undefined;
}

export async function list(req: Request, res: Response) {
  const { schoolIds, classeIds, serieIds, cycleIds, subjectIds, types } = req.query;
  const pagination = parsePagination(req.query);

  const result = await publicResourcesService.listPublicResources(
    {
      schoolIds: parseCsvIds(schoolIds),
      classeIds: parseCsvIds(classeIds),
      serieIds: parseCsvIds(serieIds),
      cycleIds: parseCsvIds(cycleIds),
      subjectIds: parseCsvIds(subjectIds),
      types: parseTypes(types),
    },
    pagination
  );
  res.json(result);
}

export async function getOne(req: Request<{ resourceId: string }>, res: Response) {
  const resource = await publicResourcesService.getPublicResource(req.params.resourceId);
  res.json(resource);
}

export async function download(req: Request<{ resourceId: string }>, res: Response) {
  const { filePath, fileName, mimeType } = await publicResourcesService.getPublicResourceFile(req.params.resourceId);
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.sendFile(filePath);
}

export async function filters(_req: Request, res: Response) {
  const options = await publicResourcesService.listPublicFilterOptions();
  res.json(options);
}
