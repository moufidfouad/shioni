import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import type { CoefficientInput, SubjectInput, UpdateSubjectInput } from "./subjects.schema";

const coefficientInclude = {
  groupe: { select: { id: true, name: true } },
  teacher: { select: { id: true, fullName: true } },
} as const;

async function assertStaffInSchool(schoolId: string, staffId: string) {
  const staff = await prisma.staffMember.findFirst({ where: { id: staffId, schoolId } });
  if (!staff) throw ApiError.notFound("Membre du personnel introuvable dans cette école.");
  return staff;
}

export async function listSubjects(schoolId: string) {
  return prisma.subject.findMany({
    where: { schoolId },
    include: { coefficients: { include: coefficientInclude } },
    orderBy: { name: "asc" },
  });
}

export async function getSubject(schoolId: string, subjectId: string) {
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, schoolId },
    include: { coefficients: { include: coefficientInclude } },
  });
  if (!subject) throw ApiError.notFound("Matière introuvable.");
  return subject;
}

export async function createSubject(schoolId: string, input: SubjectInput) {
  const existing = await prisma.subject.findFirst({ where: { schoolId, name: input.name } });
  if (existing) throw ApiError.conflict("Une matière porte déjà ce nom dans cette école.");

  return prisma.subject.create({
    data: { schoolId, name: input.name, obligatoire: input.obligatoire ?? true },
  });
}

export async function updateSubject(schoolId: string, subjectId: string, input: UpdateSubjectInput) {
  await getSubject(schoolId, subjectId);
  return prisma.subject.update({ where: { id: subjectId }, data: input });
}

export async function deleteSubject(schoolId: string, subjectId: string) {
  await getSubject(schoolId, subjectId);
  await prisma.subject.delete({ where: { id: subjectId } });
}

// Upsert en masse : un coefficient par classe pour cette matière. Comme pour
// les frais scolaires (parameters.service.ts), on n'efface pas les lignes
// absentes du tableau reçu — la suppression d'une classe précise passe par
// deleteCoefficient ci-dessous.
export async function setCoefficients(schoolId: string, subjectId: string, coefficients: CoefficientInput[]) {
  await getSubject(schoolId, subjectId);

  for (const c of coefficients) {
    if (c.teacherId) await assertStaffInSchool(schoolId, c.teacherId);
  }

  return prisma.$transaction(
    coefficients.map((c) =>
      prisma.subjectCoefficient.upsert({
        where: { subjectId_groupeId: { subjectId, groupeId: c.groupeId } },
        // Comme `hoursPerWeek`, un `teacherId` omis n'efface pas une valeur
        // déjà en base (Prisma traite `undefined` comme "ne pas toucher ce
        // champ" dans un `update`, contrairement à `null`) : cet endpoint
        // reste additif, sans diff — retirer un enseignant assigné est une
        // action explicite distincte, pas encore exposée (comme
        // `deleteCoefficient` pour retirer une classe entière).
        update: { coefficient: c.coefficient, hoursPerWeek: c.hoursPerWeek, teacherId: c.teacherId },
        create: {
          subjectId,
          groupeId: c.groupeId,
          coefficient: c.coefficient,
          hoursPerWeek: c.hoursPerWeek,
          teacherId: c.teacherId,
        },
        include: coefficientInclude,
      })
    )
  );
}

export async function deleteCoefficient(schoolId: string, subjectId: string, groupeId: string) {
  await getSubject(schoolId, subjectId);
  await prisma.subjectCoefficient.deleteMany({ where: { subjectId, groupeId } });
}
