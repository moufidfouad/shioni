import { prisma, FeeStatus } from "../../config/prisma";
import {
  buildPaginationMeta,
  PaginationQuery,
  toSkipTake,
} from "../../utils/pagination";

const studentSelect = {
  id: true,
  matricule: true,
  fullName: true,
  groupeId: true,
  groupe: { select: { id: true, name: true } },
} as const;

export interface PaymentTrackingFilters {
  schoolYearId: string;
  groupeId?: string;
  search?: string;
}

function buildStudentWhere(
  schoolId: string,
  opts: Pick<PaymentTrackingFilters, "groupeId" | "search">,
) {
  return {
    schoolId,
    groupeId: opts.groupeId || undefined,
    fullName: opts.search
      ? { contains: opts.search, mode: "insensitive" as const }
      : undefined,
  };
}

// Précharge élèves de la page courante + TOUTES leurs lignes Enrollment/
// TuitionFee de l'année en 2 requêtes batch (`studentId: { in: [...] }`),
// puis regroupe en mémoire — même discipline anti-N+1 que les correctifs
// audit (itération 33) sur les saisies groupées.
export async function listPaymentTracking(
  schoolId: string,
  opts: PaymentTrackingFilters,
  pagination: PaginationQuery,
) {
  const where = buildStudentWhere(schoolId, opts);
  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      select: studentSelect,
      orderBy: { fullName: "asc" },
      ...toSkipTake(pagination),
    }),
    prisma.student.count({ where }),
  ]);

  const studentIds = students.map((s) => s.id);
  const { enrollmentByStudent, tuitionByStudent } = await loadFeesByStudent(
    studentIds,
    opts.schoolYearId,
  );

  const data = students.map((student) =>
    summarizeStudent(student, enrollmentByStudent, tuitionByStudent),
  );
  return { data, pagination: buildPaginationMeta(total, pagination) };
}

// Cartes de stats du rapport — combien d'élèves à jour / en retard sur
// chaque volet, sur le même périmètre (année + classe optionnelle) que la
// liste ci-dessus.
export async function getPaymentTrackingStats(
  schoolId: string,
  opts: Pick<PaymentTrackingFilters, "groupeId"> & { schoolYearId: string },
) {
  const studentWhere = buildStudentWhere(schoolId, { groupeId: opts.groupeId });
  const students = await prisma.student.findMany({
    where: studentWhere,
    select: { id: true },
  });
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return {
      totalStudents: 0,
      enrollmentUpToDate: 0,
      enrollmentBehind: 0,
      enrollmentNotTracked: 0,
      tuitionUpToDate: 0,
      tuitionBehind: 0,
    };
  }

  const { enrollmentByStudent, tuitionByStudent } = await loadFeesByStudent(
    studentIds,
    opts.schoolYearId,
  );

  let enrollmentUpToDate = 0;
  let enrollmentBehind = 0;
  let enrollmentNotTracked = 0;
  let tuitionUpToDate = 0;
  let tuitionBehind = 0;

  for (const id of studentIds) {
    const enrollment = enrollmentByStudent.get(id);
    if (!enrollment) enrollmentNotTracked += 1;
    else if (enrollment.status === FeeStatus.SOLDE) enrollmentUpToDate += 1;
    else enrollmentBehind += 1;

    const tuitions = tuitionByStudent.get(id) ?? [];
    const isUpToDate =
      tuitions.length === 0 ||
      tuitions.every((t) => t.status === FeeStatus.SOLDE);
    if (isUpToDate) tuitionUpToDate += 1;
    else tuitionBehind += 1;
  }

  return {
    totalStudents: studentIds.length,
    enrollmentUpToDate,
    enrollmentBehind,
    enrollmentNotTracked,
    tuitionUpToDate,
    tuitionBehind,
  };
}

type EnrollmentRow = {
  studentId: string;
  status: FeeStatus;
  feeDue: unknown;
  amountPaid: unknown;
  createdAt: Date;
};
type TuitionRow = {
  studentId: string;
  month: number;
  status: FeeStatus;
  amountDue: unknown;
  amountPaid: unknown;
};

async function loadFeesByStudent(studentIds: string[], schoolYearId: string) {
  const enrollmentByStudent = new Map<string, EnrollmentRow>();
  const tuitionByStudent = new Map<string, TuitionRow[]>();
  if (studentIds.length === 0) return { enrollmentByStudent, tuitionByStudent };

  const [enrollments, tuitionFees] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId: { in: studentIds }, schoolYearId },
      select: {
        studentId: true,
        status: true,
        feeDue: true,
        amountPaid: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tuitionFee.findMany({
      where: { studentId: { in: studentIds }, schoolYearId },
      select: {
        studentId: true,
        month: true,
        status: true,
        amountDue: true,
        amountPaid: true,
      },
    }),
  ]);

  // Plusieurs `Enrollment` sont possibles pour un même élève/année
  // (redoublement/correction, voir le commentaire sur schema.prisma) : on
  // retient la plus récente (`createdAt desc` ci-dessus, première
  // rencontrée par élève) plutôt que d'additionner des lignes qui ne
  // représentent pas la même inscription.
  for (const e of enrollments) {
    if (!enrollmentByStudent.has(e.studentId))
      enrollmentByStudent.set(e.studentId, e);
  }

  for (const t of tuitionFees) {
    const list = tuitionByStudent.get(t.studentId) ?? [];
    list.push(t);
    tuitionByStudent.set(t.studentId, list);
  }

  return { enrollmentByStudent, tuitionByStudent };
}

function summarizeStudent(
  student: {
    id: string;
    matricule: string;
    fullName: string;
    groupeId: string | null;
    groupe: { id: string; name: string } | null;
  },
  enrollmentByStudent: Map<string, EnrollmentRow>,
  tuitionByStudent: Map<string, TuitionRow[]>,
) {
  const enrollment = enrollmentByStudent.get(student.id);
  const tuitions = tuitionByStudent.get(student.id) ?? [];

  const tuitionTotalDue = tuitions.reduce(
    (sum, t) => sum + Number(t.amountDue),
    0,
  );
  const tuitionTotalPaid = tuitions.reduce(
    (sum, t) => sum + Number(t.amountPaid),
    0,
  );
  const monthsUnpaid = tuitions
    .filter((t) => t.status !== FeeStatus.SOLDE)
    .map((t) => t.month)
    .sort((a, b) => a - b);

  return {
    student,
    enrollment: enrollment
      ? {
          status: enrollment.status,
          feeDue: Number(enrollment.feeDue),
          amountPaid: Number(enrollment.amountPaid),
        }
      : null,
    tuition: {
      monthsTracked: tuitions.length,
      monthsUnpaid,
      totalDue: tuitionTotalDue,
      totalPaid: tuitionTotalPaid,
      // "À jour" : soit aucun mois généré pour l'instant pour cet élève
      // (rien à devoir tant que `generateTuitionFees` n'a pas tourné pour
      // lui — pas un retard, un état "non suivi" distinct d'un vrai
      // impayé), soit tous les mois générés jusqu'ici sont soldés.
      upToDate: tuitions.length === 0 || monthsUnpaid.length === 0,
    },
  };
}
