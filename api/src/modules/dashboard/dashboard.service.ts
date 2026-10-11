import { prisma } from "../../config/prisma";
import { getStudentStats } from "../students/students.service";
import { getStaffStats } from "../personnel/personnel.service";
import { getEnrollmentStats } from "../enrollments/enrollments.service";
import { getFinanceStats } from "../finances/finance.service";
import { getSchoolAttendanceOverview } from "../attendance/attendance.service";
import { getTimetableOverview } from "../timetable/timetable.service";

// Reflète la feuille Excel "TABLEAU DE BORD" : pas de nouvelle table (voir
// schéma Prisma), une simple agrégation en lecture de ce que chaque module
// calcule déjà — `getStudentStats`/`getStaffStats`/`getEnrollmentStats`
// réutilisés tels quels, `getSchoolAttendanceOverview`/
// `getTimetableOverview` ajoutés à cette itération dans leurs services
// respectifs pour une vue toutes classes confondues (les fonctions
// existantes, `getAttendanceStats`/`listTimetable`, restent scopées à une
// classe). Toutes les requêtes tournent en parallèle (`Promise.all`) : ce
// sont des lectures indépendantes, pas de transaction nécessaire.
export async function getDashboard(schoolId: string, schoolYearIdParam?: string) {
  // Itération 44 — `School.schoolYear` (texte libre) remplacé par
  // `currentSchoolYearId` (FK vers `SchoolYear`, voir schema.prisma) :
  // l'année scolaire par défaut = celle configurée sur l'école (onglet
  // "Années scolaires" de la page Structure pédagogique) si aucune n'est
  // passée en query — cohérent avec le fait que les frais d'inscription
  // n'ont de sens agrégés que par année. `include` (pas `select`) pour
  // récupérer aussi le libellé affiché au frontend.
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: { currentSchoolYear: { select: { id: true, label: true } } },
  });
  const schoolYearId = schoolYearIdParam || school?.currentSchoolYearId || undefined;
  const schoolYearLabel = schoolYearIdParam ? undefined : school?.currentSchoolYear?.label;
  const year = new Date().getFullYear();

  const [students, staff, classCount, enrollments, finance, attendance, timetable] = await Promise.all([
    getStudentStats(schoolId),
    getStaffStats(schoolId),
    prisma.groupe.count({ where: { schoolId } }),
    getEnrollmentStats(schoolId, schoolYearId),
    getFinanceStats(schoolId, year),
    getSchoolAttendanceOverview(schoolId),
    getTimetableOverview(schoolId),
  ]);

  return {
    schoolYearId: schoolYearId ?? null,
    // `null` (pas juste absent) quand un `schoolYearIdParam` explicite a été
    // passé : on ne connaît alors pas forcément son libellé sans requête
    // supplémentaire, et le frontend n'en a de toute façon besoin que pour
    // la valeur par défaut (voir SchoolOverviewPage.tsx).
    schoolYearLabel: schoolYearLabel ?? null,
    students,
    staff,
    classCount,
    enrollments,
    finance: { ...finance, year },
    attendance,
    timetable,
  };
}
