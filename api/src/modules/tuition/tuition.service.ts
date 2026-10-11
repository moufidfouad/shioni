import { prisma, FeeStatus } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { buildPaginationMeta, PaginationQuery, toSkipTake } from "../../utils/pagination";
import { computeStatus } from "../enrollments/enrollments.service";
import type {
  GenerateTuitionFeesInput,
  RecordTuitionPaymentInput,
  TuitionFeeInput,
  UpdateTuitionFeeInput,
} from "./tuition.schema";

const studentSelect = {
  select: {
    id: true,
    matricule: true,
    fullName: true,
    groupeId: true,
    groupe: { select: { id: true, name: true } },
  },
} as const;

async function assertStudentInSchool(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
  if (!student) throw ApiError.notFound("Élève introuvable dans cette école.");
}

async function assertGroupeInSchool(schoolId: string, groupeId: string) {
  const groupe = await prisma.groupe.findFirst({ where: { id: groupeId, schoolId } });
  if (!groupe) throw ApiError.notFound("Classe introuvable dans cette école.");
}

export interface TuitionFeeFilters {
  schoolYearId?: string;
  month?: number;
  status?: FeeStatus;
  groupeId?: string;
  studentId?: string;
  search?: string;
}

// Même patron que `enrollments.service.ts::buildEnrollmentWhere` : extrait
// dans une fonction dédiée pour que la version paginée (endpoint HTTP) et
// `listAllTuitionFees` (usage interne, toujours borné à un `studentId`
// précis) restent strictement synchronisées.
function buildTuitionWhere(schoolId: string, opts: TuitionFeeFilters) {
  return {
    schoolYearId: opts.schoolYearId || undefined,
    month: opts.month || undefined,
    status: opts.status || undefined,
    studentId: opts.studentId || undefined,
    student: {
      schoolId,
      groupeId: opts.groupeId || undefined,
      fullName: opts.search ? { contains: opts.search, mode: "insensitive" as const } : undefined,
    },
  };
}

export async function listTuitionFees(schoolId: string, opts: TuitionFeeFilters, pagination: PaginationQuery) {
  const where = buildTuitionWhere(schoolId, opts);
  const [fees, total] = await Promise.all([
    prisma.tuitionFee.findMany({
      where,
      include: { student: studentSelect, schoolYear: true },
      orderBy: [{ schoolYear: { order: "desc" } }, { month: "asc" }, { student: { fullName: "asc" } }],
      ...toSkipTake(pagination),
    }),
    prisma.tuitionFee.count({ where }),
  ]);
  return { data: fees, pagination: buildPaginationMeta(total, pagination) };
}

// Helper interne NON paginé — même rôle que
// `enrollments.service.ts::listAllEnrollments` pour student-portal/
// parent-portal (toujours borné à UN élève précis).
export async function listAllTuitionFees(schoolId: string, opts: TuitionFeeFilters) {
  const where = buildTuitionWhere(schoolId, opts);
  return prisma.tuitionFee.findMany({
    where,
    include: { student: studentSelect, schoolYear: true },
    orderBy: [{ schoolYear: { order: "desc" } }, { month: "asc" }],
  });
}

// Cartes de stats — même forme que `getEnrollmentStats`, filtrable en plus
// par mois (une vue "où en est-on ce mois-ci ?" a du sens pour l'écolage,
// contrairement au droit d'inscription qui n'a qu'une échéance par an).
// Itération 40 — `groupeId` ajouté : les cartes doivent refléter la classe
// sélectionnée dans les filtres de la page, comme le fait déjà la liste
// (`buildTuitionWhere`) juste au-dessus, pas seulement année/mois.
export async function getTuitionStats(schoolId: string, schoolYearId?: string, month?: number, groupeId?: string) {
  const fees = await prisma.tuitionFee.findMany({
    where: {
      schoolYearId: schoolYearId || undefined,
      month: month || undefined,
      student: { schoolId, groupeId: groupeId || undefined },
    },
    select: { amountDue: true, amountPaid: true, discountAmount: true, status: true },
  });

  const totalDue = fees.reduce((sum, f) => sum + Number(f.amountDue), 0);
  const totalPaid = fees.reduce((sum, f) => sum + Number(f.amountPaid), 0);
  const totalDiscounts = fees.reduce((sum, f) => sum + Number(f.discountAmount), 0);

  return {
    count: fees.length,
    totalDue,
    totalPaid,
    totalRemaining: totalDue - totalPaid,
    totalDiscounts,
    solde: fees.filter((f) => f.status === FeeStatus.SOLDE).length,
    partiel: fees.filter((f) => f.status === FeeStatus.PARTIEL).length,
    impaye: fees.filter((f) => f.status === FeeStatus.IMPAYE).length,
  };
}

export async function getTuitionFee(schoolId: string, tuitionFeeId: string) {
  const fee = await prisma.tuitionFee.findFirst({
    where: { id: tuitionFeeId, student: { schoolId } },
    include: { student: studentSelect, schoolYear: true },
  });
  if (!fee) throw ApiError.notFound("Écolage introuvable.");
  return fee;
}

// Création manuelle d'UNE ligne (ex : un mois oublié par la génération en
// masse, ou un élève inscrit en cours d'année). La génération en masse
// (`generateTuitionFees` ci-dessous) reste le chemin normal pour créer les
// 12 lignes d'une année.
export async function createTuitionFee(schoolId: string, input: TuitionFeeInput) {
  await assertStudentInSchool(schoolId, input.studentId);

  const existing = await prisma.tuitionFee.findFirst({
    where: { studentId: input.studentId, schoolYearId: input.schoolYearId, month: input.month },
  });
  if (existing) throw ApiError.conflict("Cet élève a déjà un écolage enregistré pour ce mois.");

  const amountPaid = input.amountPaid ?? 0;
  return prisma.tuitionFee.create({
    data: {
      studentId: input.studentId,
      schoolYearId: input.schoolYearId,
      month: input.month,
      amountDue: input.amountDue,
      amountPaid,
      discountAmount: input.discountAmount ?? 0,
      discountReason: input.discountAmount ? input.discountReason : undefined,
      paymentMode: input.paymentMode,
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : undefined,
      status: computeStatus(input.amountDue, amountPaid),
    },
    include: { student: studentSelect, schoolYear: true },
  });
}

export async function updateTuitionFee(schoolId: string, tuitionFeeId: string, input: UpdateTuitionFeeInput) {
  const current = await getTuitionFee(schoolId, tuitionFeeId);
  const amountDue = input.amountDue ?? Number(current.amountDue);
  const amountPaid = input.amountPaid ?? Number(current.amountPaid);

  return prisma.tuitionFee.update({
    where: { id: tuitionFeeId },
    data: {
      amountDue: input.amountDue,
      amountPaid: input.amountPaid,
      discountAmount: input.discountAmount,
      discountReason: input.discountAmount === 0 ? null : input.discountReason,
      paymentMode: input.paymentMode,
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : undefined,
      status: computeStatus(amountDue, amountPaid),
    },
    include: { student: studentSelect, schoolYear: true },
  });
}

export async function recordTuitionPayment(schoolId: string, tuitionFeeId: string, input: RecordTuitionPaymentInput) {
  const current = await getTuitionFee(schoolId, tuitionFeeId);
  const amountPaid = Number(current.amountPaid) + input.amount;

  return prisma.tuitionFee.update({
    where: { id: tuitionFeeId },
    data: {
      amountPaid,
      paymentMode: input.paymentMode ?? current.paymentMode,
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
      status: computeStatus(Number(current.amountDue), amountPaid),
    },
    include: { student: studentSelect, schoolYear: true },
  });
}

export async function deleteTuitionFee(schoolId: string, tuitionFeeId: string) {
  await getTuitionFee(schoolId, tuitionFeeId);
  await prisma.tuitionFee.delete({ where: { id: tuitionFeeId } });
}

// Génération en masse — cadrage explicite de l'utilisateur (voir
// tuition.schema.ts). Précharge tout ce qu'il faut en 3 requêtes batch
// (élèves+niveau, tarifs par niveau, lignes déjà existantes) plutôt qu'une
// requête par élève/mois — même discipline que les correctifs audit sur
// `bulkSetGradeEvaluation`/`bulkSetAttendance` (itération 33).
export async function generateTuitionFees(schoolId: string, input: GenerateTuitionFeesInput) {
  if (input.groupeId) await assertGroupeInSchool(schoolId, input.groupeId);

  // Itération 35 — `groupe.levelName` (texte libre) n'existe plus : le
  // niveau d'un élève passe désormais par `groupe.classe` (FK réelle), sur
  // laquelle `FeeLevel` se rattache lui-même par `classeId`.
  const students = await prisma.student.findMany({
    where: { schoolId, groupeId: input.groupeId || undefined },
    select: { id: true, groupe: { select: { classeId: true, classe: { select: { name: true } } } } },
  });
  if (students.length === 0) return { created: 0, skipped: 0, unconfiguredLevels: [] as string[] };

  const feeLevels = await prisma.feeLevel.findMany({
    where: { schoolId },
    select: { classeId: true, monthlyAmount: true },
  });
  const monthlyRateByClasse = new Map<string, number | null>(
    feeLevels.map((l) => [l.classeId, l.monthlyAmount === null || l.monthlyAmount === undefined ? null : Number(l.monthlyAmount)])
  );

  const studentIds = students.map((s) => s.id);
  const existing = await prisma.tuitionFee.findMany({
    where: { studentId: { in: studentIds }, schoolYearId: input.schoolYearId, month: { in: input.months } },
    select: { studentId: true, month: true },
  });
  const existingKeys = new Set(existing.map((e) => `${e.studentId}:${e.month}`));

  const discountAmount = input.discountAmount ?? 0;
  const discountReason = discountAmount > 0 ? input.discountReason : undefined;

  const unconfiguredLevels = new Set<string>();
  const rowsToCreate: {
    studentId: string;
    schoolYearId: string;
    month: number;
    amountDue: number;
    discountAmount: number;
    discountReason?: string;
    status: FeeStatus;
  }[] = [];

  for (const student of students) {
    const classeId = student.groupe?.classeId ?? null;
    const levelName = student.groupe?.classe?.name ?? null;
    const rawRate = classeId ? monthlyRateByClasse.get(classeId) : undefined;
    if (levelName && (rawRate === null || rawRate === undefined)) unconfiguredLevels.add(levelName);
    const monthlyRate = rawRate ?? 0;
    const amountDue = Math.max(0, monthlyRate - discountAmount);

    for (const month of input.months) {
      const key = `${student.id}:${month}`;
      if (existingKeys.has(key)) continue;
      rowsToCreate.push({
        studentId: student.id,
        schoolYearId: input.schoolYearId,
        month,
        amountDue,
        discountAmount,
        discountReason,
        status: computeStatus(amountDue, 0),
      });
    }
  }

  if (rowsToCreate.length > 0) {
    // `skipDuplicates` en défense supplémentaire contre une génération
    // relancée en parallèle (deux requêtes concurrentes sur les mêmes
    // élèves/mois) : la contrainte `@@unique([studentId, schoolYearId,
    // month])` du schéma protège déjà contre le doublon en base, ceci
    // évite juste que la seconde requête échoue bruyamment dessus.
    await prisma.tuitionFee.createMany({ data: rowsToCreate, skipDuplicates: true });
  }

  return {
    created: rowsToCreate.length,
    skipped: studentIds.length * input.months.length - rowsToCreate.length,
    unconfiguredLevels: Array.from(unconfiguredLevels),
  };
}
