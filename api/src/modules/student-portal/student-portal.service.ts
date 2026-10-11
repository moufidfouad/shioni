import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { listAllAttendance } from "../attendance/attendance.service";
import { getStudentBulletin } from "../grades/grades.service";
import { listAllEnrollments } from "../enrollments/enrollments.service";
import { listTimetable } from "../timetable/timetable.service";
import { composeGroupeLabel, groupeWithLabelSelect } from "../../utils/groupeLabel";

// Itération 31 — module Élève : c'est ici, et UNIQUEMENT ici, qu'un compte
// Élève (Student.userId, voir schema.prisma) peut lire ses propres données.
// Même philosophie que parent-portal (itération 27) : séparé des modules
// Grades/Attendance/Enrollments "classiques" (réservés au personnel via
// requireAnySchoolRole/requireSchoolRole), pour ne jamais s'appuyer sur un
// rôle générique qui exposerait tous les élèves de l'école. Plus simple que
// parent-portal : pas de liste "mes enfants" (un compte Élève ne concerne
// jamais qu'UN SEUL élève, lui-même), donc pas de table de liaison à
// interroger — un simple `findFirst` sur le FK direct `Student.userId`.

// Itération 113 — même extension que parent-portal.service.ts::childSelect/
// toChildDTO (voir ce fichier pour le raisonnement complet) : `groupe`
// embarque désormais classe/série pour composer `groupeLabel`, `toStudentDTO`
// retaille vers la forme publique historique `{ id, name }` + ajoute
// `groupeLabel`.
const studentSelect = {
  select: {
    id: true,
    matricule: true,
    fullName: true,
    groupeId: true,
    groupe: groupeWithLabelSelect,
  },
} as const;

type StudentRecord = {
  id: string;
  matricule: string;
  fullName: string;
  groupeId: string | null;
  groupe: { id: string; name: string; classe: { name: string }; serie: { name: string } | null } | null;
};

function toStudentDTO(student: StudentRecord) {
  return {
    id: student.id,
    matricule: student.matricule,
    fullName: student.fullName,
    groupeId: student.groupeId,
    groupe: student.groupe ? { id: student.groupe.id, name: student.groupe.name } : null,
    groupeLabel: composeGroupeLabel(student.groupe),
  };
}

// Porte d'entrée unique de tout le module : vérifie que `userId` a bien un
// compte Élève lié à un `Student` de `schoolId`. Lève `forbidden` sinon —
// jamais de fuite d'information à un utilisateur non lié. Contrairement à
// assertGuardianOfStudent (parent-portal), pas de `studentId` en paramètre :
// l'élève concerné est TOUJOURS celui lié au compte connecté, jamais choisi
// depuis l'URL/le frontend.
export async function assertOwnStudent(userId: string, schoolId: string) {
  const student = await prisma.student.findFirst({
    where: { userId, schoolId },
    ...studentSelect,
  });
  if (!student) throw ApiError.forbidden("Ce compte n'est lié à aucune fiche élève de cette école.");
  return student;
}

// Résumé en lecture seule pour l'élève lui-même : présences, frais de
// scolarité, bulletin du trimestre demandé — identique au périmètre du
// portail Parent (itération 27), moins le sélecteur multi-enfants qui n'a
// pas de sens ici.
export async function getMySummary(
  userId: string,
  schoolId: string,
  opts: { trimestre?: number; schoolYearId?: string }
) {
  const student = await assertOwnStudent(userId, schoolId);

  const [attendance, enrollments, bulletin] = await Promise.all([
    listAllAttendance(schoolId, { studentId: student.id }),
    listAllEnrollments(schoolId, { studentId: student.id, schoolYearId: opts.schoolYearId }),
    student.groupeId && opts.trimestre
      ? getStudentBulletin(schoolId, student.id, opts.trimestre).catch(() => null)
      : Promise.resolve(null),
  ]);

  return { student: toStudentDTO(student), attendance, enrollments, bulletin };
}

// Itération 72 — module Phase 2b (emploi du temps mobile), même patron que
// parent-portal.service.ts::getChildTimetable. `student.groupeId` peut être
// `null` (pas encore affecté) : tableau vide plutôt qu'un `listTimetable`
// sans `groupeId` (qui renverrait tout l'emploi du temps de l'école).
export async function getMyTimetable(userId: string, schoolId: string) {
  const student = await assertOwnStudent(userId, schoolId);
  if (!student.groupeId) return [];
  return listTimetable(schoolId, { groupeId: student.groupeId });
}
