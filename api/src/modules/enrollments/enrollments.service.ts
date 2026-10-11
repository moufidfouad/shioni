import { prisma, FeeStatus } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { buildPaginationMeta, PaginationQuery, toSkipTake } from "../../utils/pagination";
import type { EnrollmentInput, RecordPaymentInput, UpdateEnrollmentInput } from "./enrollments.schema";

const studentSelect = {
  select: {
    id: true,
    matricule: true,
    fullName: true,
    groupeId: true,
    groupe: { select: { id: true, name: true } },
  },
} as const;

// Le statut n'est jamais saisi à la main : il découle toujours des montants,
// pour ne jamais pouvoir diverger d'eux (ex: un paiement enregistré met
// forcément à jour le statut dans la même opération). Exportée pour être
// réutilisée telle quelle par `prisma/seeds/enrollments.seed.ts` plutôt que
// de dupliquer cette règle métier dans le script de seed.
export function computeStatus(feeDue: number, amountPaid: number): FeeStatus {
  if (amountPaid <= 0) return FeeStatus.IMPAYE;
  if (amountPaid >= feeDue) return FeeStatus.SOLDE;
  return FeeStatus.PARTIEL;
}

async function assertStudentInSchool(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
  if (!student) throw ApiError.notFound("Élève introuvable dans cette école.");
}

export interface EnrollmentFilters {
  schoolYearId?: string;
  status?: FeeStatus;
  groupeId?: string;
  studentId?: string;
  search?: string;
}

// `where` extrait dans une fonction dédiée : réutilisée à l'identique par la
// version paginée ci-dessous (endpoint HTTP) et par `listAllEnrollments`
// (appelée en interne par student-portal/parent-portal, toujours avec un
// `studentId` précis — les frais d'UN élève, naturellement borné).
function buildEnrollmentWhere(schoolId: string, opts: EnrollmentFilters) {
  return {
    schoolYearId: opts.schoolYearId || undefined,
    status: opts.status || undefined,
    studentId: opts.studentId || undefined,
    student: {
      schoolId,
      groupeId: opts.groupeId || undefined,
      fullName: opts.search ? { contains: opts.search, mode: "insensitive" as const } : undefined,
    },
  };
}

// Correctif audit (pagination) — endpoint HTTP `GET /enrollments` : renvoie
// `{ data, pagination }` au lieu d'un tableau brut (voir utils/pagination.ts).
export async function listEnrollments(schoolId: string, opts: EnrollmentFilters, pagination: PaginationQuery) {
  const where = buildEnrollmentWhere(schoolId, opts);
  const [enrollments, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      include: { student: studentSelect, schoolYear: true },
      // Tri par l'ORDRE de l'année scolaire (`SchoolYear.order`), plus
      // significatif que l'id (uuid) désormais utilisé comme clé étrangère
      // depuis l'itération 44 — un tri sur l'id serait arbitraire.
      orderBy: [{ schoolYear: { order: "desc" } }, { student: { fullName: "asc" } }],
      ...toSkipTake(pagination),
    }),
    prisma.enrollment.count({ where }),
  ]);
  return { data: enrollments, pagination: buildPaginationMeta(total, pagination) };
}

// Helper interne NON paginé, conservé pour student-portal.service.ts /
// parent-portal.service.ts, qui composent un résumé à partir des
// inscriptions COMPLÈTES d'UN élève précis (jamais la table entière d'une
// école) — pas besoin de pagination pour ce cas d'usage.
export async function listAllEnrollments(schoolId: string, opts: EnrollmentFilters) {
  const where = buildEnrollmentWhere(schoolId, opts);
  return prisma.enrollment.findMany({
    where,
    include: { student: studentSelect, schoolYear: true },
    orderBy: [{ schoolYear: { order: "desc" } }, { student: { fullName: "asc" } }],
  });
}

// Cartes de stats équivalentes à l'en-tête de la feuille "INSCRIPTIONS &
// FRAIS" : total attendu/perçu/restant et répartition par statut. Filtrable
// par année scolaire (les montants n'ont de sens agrégés que par année).
// Itération 41 — `groupeId` ajouté : même correctif que
// `tuition.service.ts::getTuitionStats` (itération 40) — les cartes doivent
// refléter la classe sélectionnée dans les filtres de la page, comme le fait
// déjà la liste (`buildEnrollmentWhere`) juste au-dessus.
export async function getEnrollmentStats(schoolId: string, schoolYearId?: string, groupeId?: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      schoolYearId: schoolYearId || undefined,
      student: { schoolId, groupeId: groupeId || undefined },
    },
    select: { feeDue: true, amountPaid: true, discountAmount: true, status: true },
  });

  const totalDue = enrollments.reduce((sum, e) => sum + Number(e.feeDue), 0);
  const totalPaid = enrollments.reduce((sum, e) => sum + Number(e.amountPaid), 0);
  // Total des réductions négociées, purement informatif (ne rentre dans
  // aucun autre total ci-dessus : `feeDue` intègre déjà la réduction).
  const totalDiscounts = enrollments.reduce((sum, e) => sum + Number(e.discountAmount), 0);

  return {
    count: enrollments.length,
    totalDue,
    totalPaid,
    totalRemaining: totalDue - totalPaid,
    totalDiscounts,
    solde: enrollments.filter((e) => e.status === FeeStatus.SOLDE).length,
    partiel: enrollments.filter((e) => e.status === FeeStatus.PARTIEL).length,
    impaye: enrollments.filter((e) => e.status === FeeStatus.IMPAYE).length,
  };
}

export async function getEnrollment(schoolId: string, enrollmentId: string) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, student: { schoolId } },
    include: { student: studentSelect, schoolYear: true },
  });
  if (!enrollment) throw ApiError.notFound("Inscription introuvable.");
  return enrollment;
}

export async function createEnrollment(schoolId: string, input: EnrollmentInput) {
  await assertStudentInSchool(schoolId, input.studentId);

  // Pas de contrainte d'unicité en base sur (studentId, schoolYearId) — le
  // modèle autorise plusieurs lignes par élève (ex: redoublement,
  // correction) — mais dans l'usage normal une seule inscription par élève
  // et par année a du sens : on prévient le doublon involontaire ici, au
  // niveau service, plutôt qu'en base.
  const existing = await prisma.enrollment.findFirst({
    where: { studentId: input.studentId, schoolYearId: input.schoolYearId },
  });
  if (existing) throw ApiError.conflict("Cet élève a déjà une inscription pour cette année scolaire.");

  const amountPaid = input.amountPaid ?? 0;
  return prisma.enrollment.create({
    data: {
      studentId: input.studentId,
      schoolYearId: input.schoolYearId,
      feeDue: input.feeDue,
      amountPaid,
      discountAmount: input.discountAmount ?? 0,
      discountReason: input.discountAmount ? input.discountReason : undefined,
      paymentMode: input.paymentMode,
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : undefined,
      status: computeStatus(input.feeDue, amountPaid),
    },
    include: { student: studentSelect, schoolYear: true },
  });
}

export async function updateEnrollment(schoolId: string, enrollmentId: string, input: UpdateEnrollmentInput) {
  const current = await getEnrollment(schoolId, enrollmentId);
  const feeDue = input.feeDue ?? Number(current.feeDue);
  const amountPaid = input.amountPaid ?? Number(current.amountPaid);

  return prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      schoolYearId: input.schoolYearId,
      feeDue: input.feeDue,
      amountPaid: input.amountPaid,
      discountAmount: input.discountAmount,
      // Un `discountAmount` explicitement remis à 0 efface aussi le motif ;
      // sinon (champ omis, ou renseigné) le motif suit tel quel ce que
      // l'admin a saisi.
      discountReason: input.discountAmount === 0 ? null : input.discountReason,
      paymentMode: input.paymentMode,
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : undefined,
      status: computeStatus(feeDue, amountPaid),
    },
    include: { student: studentSelect, schoolYear: true },
  });
}

// Action dédiée : ajoute un paiement au montant déjà réglé (plutôt que de
// remplacer `amountPaid`), et recalcule le statut dans la foulée.
export async function recordPayment(schoolId: string, enrollmentId: string, input: RecordPaymentInput) {
  const current = await getEnrollment(schoolId, enrollmentId);
  const amountPaid = Number(current.amountPaid) + input.amount;

  return prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      amountPaid,
      paymentMode: input.paymentMode ?? current.paymentMode,
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
      status: computeStatus(Number(current.feeDue), amountPaid),
    },
    include: { student: studentSelect, schoolYear: true },
  });
}

export async function deleteEnrollment(schoolId: string, enrollmentId: string) {
  await getEnrollment(schoolId, enrollmentId);
  await prisma.enrollment.delete({ where: { id: enrollmentId } });
}
