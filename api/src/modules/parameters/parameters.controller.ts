import { Request, Response } from "express";
import { z } from "zod";
import * as parametersService from "./parameters.service";
import {
  classeSchema,
  cycleSchema,
  feeLevelsSchema,
  groupeSchema,
  pedagogicalSchema,
  salleSchema,
  schoolYearSchema,
  serieSchema,
} from "./parameters.schema";

export async function get(req: Request<{ schoolId: string }>, res: Response) {
  const params = await parametersService.getParameters(req.params.schoolId);
  res.json(params);
}

export async function update(req: Request<{ schoolId: string }>, res: Response) {
  const input = pedagogicalSchema.parse(req.body);
  const params = await parametersService.updateParameters(req.params.schoolId, input);
  res.json(params);
}

export async function setFeeLevels(req: Request<{ schoolId: string }>, res: Response) {
  const levels = feeLevelsSchema.parse(req.body);
  await parametersService.upsertFeeLevels(req.params.schoolId, levels);
  res.status(204).send();
}

export async function deleteFeeLevel(req: Request<{ schoolId: string; feeLevelId: string }>, res: Response) {
  await parametersService.deleteFeeLevel(req.params.schoolId, req.params.feeLevelId);
  res.status(204).send();
}

// ----------------------------------------------------------------------------
// Itération 35 — CRUD Cycle / Classe / Série / Groupe / Salle
// ----------------------------------------------------------------------------

export async function upsertCycle(req: Request<{ schoolId: string }>, res: Response) {
  const input = cycleSchema.parse(req.body);
  const cycle = await parametersService.upsertCycle(req.params.schoolId, input);
  res.status(201).json(cycle);
}

export async function deleteCycle(req: Request<{ schoolId: string; cycleId: string }>, res: Response) {
  await parametersService.deleteCycle(req.params.schoolId, req.params.cycleId);
  res.status(204).send();
}

export async function upsertClasse(req: Request<{ schoolId: string }>, res: Response) {
  const input = classeSchema.parse(req.body);
  const classe = await parametersService.upsertClasse(req.params.schoolId, input);
  res.status(201).json(classe);
}

export async function deleteClasse(req: Request<{ schoolId: string; classeId: string }>, res: Response) {
  await parametersService.deleteClasse(req.params.schoolId, req.params.classeId);
  res.status(204).send();
}

export async function upsertSerie(req: Request<{ schoolId: string }>, res: Response) {
  const input = serieSchema.parse(req.body);
  const serie = await parametersService.upsertSerie(req.params.schoolId, input);
  res.status(201).json(serie);
}

export async function deleteSerie(req: Request<{ schoolId: string; serieId: string }>, res: Response) {
  await parametersService.deleteSerie(req.params.schoolId, req.params.serieId);
  res.status(204).send();
}

export async function upsertGroupe(req: Request<{ schoolId: string }>, res: Response) {
  const input = groupeSchema.parse(req.body);
  const groupe = await parametersService.upsertGroupe(req.params.schoolId, input);
  res.status(201).json(groupe);
}

export async function deleteGroupe(req: Request<{ schoolId: string; groupeId: string }>, res: Response) {
  await parametersService.deleteGroupe(req.params.schoolId, req.params.groupeId);
  res.status(204).send();
}

export async function upsertSalle(req: Request<{ schoolId: string }>, res: Response) {
  const input = salleSchema.parse(req.body);
  const salle = await parametersService.upsertSalle(req.params.schoolId, input);
  res.status(201).json(salle);
}

export async function deleteSalle(req: Request<{ schoolId: string; salleId: string }>, res: Response) {
  await parametersService.deleteSalle(req.params.schoolId, req.params.salleId);
  res.status(204).send();
}

// ----------------------------------------------------------------------------
// Itération 44 — CRUD Année scolaire + définir l'année courante
// ----------------------------------------------------------------------------

export async function upsertSchoolYear(req: Request<{ schoolId: string }>, res: Response) {
  const input = schoolYearSchema.parse(req.body);
  const year = await parametersService.upsertSchoolYear(req.params.schoolId, input);
  res.status(201).json(year);
}

export async function deleteSchoolYear(req: Request<{ schoolId: string; schoolYearId: string }>, res: Response) {
  await parametersService.deleteSchoolYear(req.params.schoolId, req.params.schoolYearId);
  res.status(204).send();
}

const setCurrentSchoolYearSchema = z.object({ schoolYearId: z.string().uuid().nullable() });

export async function setCurrentSchoolYear(req: Request<{ schoolId: string }>, res: Response) {
  const { schoolYearId } = setCurrentSchoolYearSchema.parse(req.body);
  const school = await parametersService.setCurrentSchoolYear(req.params.schoolId, schoolYearId);
  res.json(school);
}
