import { Request, Response } from "express";
import * as enrollmentsService from "./enrollments.service";
import { enrollmentSchema, recordPaymentSchema, updateEnrollmentSchema } from "./enrollments.schema";
import { FeeStatus } from "../../config/prisma";
import { parsePagination } from "../../utils/pagination";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export async function list(req: Request<{ schoolId: string }>, res: Response) {
  const { schoolYearId, status, groupeId, studentId, search } = req.query;
  const pagination = parsePagination(req.query);
  const enrollments = await enrollmentsService.listEnrollments(
    req.params.schoolId,
    {
      schoolYearId: asString(schoolYearId),
      status: status === FeeStatus.SOLDE || status === FeeStatus.PARTIEL || status === FeeStatus.IMPAYE ? status : undefined,
      groupeId: asString(groupeId),
      studentId: asString(studentId),
      search: asString(search),
    },
    pagination
  );
  res.json(enrollments);
}

export async function stats(req: Request<{ schoolId: string }>, res: Response) {
  const result = await enrollmentsService.getEnrollmentStats(
    req.params.schoolId,
    asString(req.query.schoolYearId),
    asString(req.query.groupeId)
  );
  res.json(result);
}

export async function getOne(req: Request<{ schoolId: string; enrollmentId: string }>, res: Response) {
  const enrollment = await enrollmentsService.getEnrollment(req.params.schoolId, req.params.enrollmentId);
  res.json(enrollment);
}

export async function create(req: Request<{ schoolId: string }>, res: Response) {
  const input = enrollmentSchema.parse(req.body);
  const enrollment = await enrollmentsService.createEnrollment(req.params.schoolId, input);
  res.status(201).json(enrollment);
}

export async function update(req: Request<{ schoolId: string; enrollmentId: string }>, res: Response) {
  const input = updateEnrollmentSchema.parse(req.body);
  const enrollment = await enrollmentsService.updateEnrollment(req.params.schoolId, req.params.enrollmentId, input);
  res.json(enrollment);
}

export async function recordPayment(req: Request<{ schoolId: string; enrollmentId: string }>, res: Response) {
  const input = recordPaymentSchema.parse(req.body);
  const enrollment = await enrollmentsService.recordPayment(req.params.schoolId, req.params.enrollmentId, input);
  res.json(enrollment);
}

export async function remove(req: Request<{ schoolId: string; enrollmentId: string }>, res: Response) {
  await enrollmentsService.deleteEnrollment(req.params.schoolId, req.params.enrollmentId);
  res.status(204).send();
}
