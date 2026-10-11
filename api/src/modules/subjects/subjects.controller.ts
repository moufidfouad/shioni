import { Request, Response } from "express";
import * as subjectsService from "./subjects.service";
import { coefficientsSchema, subjectSchema, updateSubjectSchema } from "./subjects.schema";

export async function list(req: Request<{ schoolId: string }>, res: Response) {
  const subjects = await subjectsService.listSubjects(req.params.schoolId);
  res.json(subjects);
}

export async function getOne(req: Request<{ schoolId: string; subjectId: string }>, res: Response) {
  const subject = await subjectsService.getSubject(req.params.schoolId, req.params.subjectId);
  res.json(subject);
}

export async function create(req: Request<{ schoolId: string }>, res: Response) {
  const input = subjectSchema.parse(req.body);
  const subject = await subjectsService.createSubject(req.params.schoolId, input);
  res.status(201).json(subject);
}

export async function update(req: Request<{ schoolId: string; subjectId: string }>, res: Response) {
  const input = updateSubjectSchema.parse(req.body);
  const subject = await subjectsService.updateSubject(req.params.schoolId, req.params.subjectId, input);
  res.json(subject);
}

export async function remove(req: Request<{ schoolId: string; subjectId: string }>, res: Response) {
  await subjectsService.deleteSubject(req.params.schoolId, req.params.subjectId);
  res.status(204).send();
}

export async function setCoefficients(req: Request<{ schoolId: string; subjectId: string }>, res: Response) {
  const coefficients = coefficientsSchema.parse(req.body);
  await subjectsService.setCoefficients(req.params.schoolId, req.params.subjectId, coefficients);
  res.status(204).send();
}

export async function deleteCoefficient(
  req: Request<{ schoolId: string; subjectId: string; groupeId: string }>,
  res: Response
) {
  await subjectsService.deleteCoefficient(req.params.schoolId, req.params.subjectId, req.params.groupeId);
  res.status(204).send();
}
