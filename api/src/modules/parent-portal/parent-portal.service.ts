import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { listAllAttendance } from "../attendance/attendance.service";
import { getStudentBulletin } from "../grades/grades.service";
import { listAllEnrollments } from "../enrollments/enrollments.service";
import { listTimetable } from "../timetable/timetable.service";
import { composeGroupeLabel, groupeWithLabelSelect } from "../../utils/groupeLabel";

// Itération 27 — module Parent : c'est ici, et UNIQUEMENT ici, qu'un compte
// Parent (StudentGuardian, voir schema.prisma) peut lire des données sur un
// élève. Volontairement séparé des modules Grades/Attendance/Enrollments
// "classiques" (qui restent réservés au personnel via requireAnySchoolRole/
// requireSchoolRole) : chaque fonction ci-dessous vérifie explicitement le
// lien StudentGuardian avant de renvoyer quoi que ce soit, plutôt que de
// s'appuyer sur un rôle générique qui exposerait tous les élèves de l'école.

// Itération 113 — `groupe` embarque désormais classe/série (via
// `groupeWithLabelSelect`, voir utils/groupeLabel.ts) pour pouvoir composer
// `groupeLabel` ci-dessous ; `toChildDTO` retaille vers la forme publique
// `{ id, name }` pour `groupe` (inchangée pour ne rien casser côté
// frontend/mobile) et ajoute le nouveau champ `groupeLabel`.
const childSelect = {
  select: {
    id: true,
    matricule: true,
    fullName: true,
    groupeId: true,
    groupe: groupeWithLabelSelect,
  },
} as const;

type ChildRecord = {
  id: string;
  matricule: string;
  fullName: string;
  groupeId: string | null;
  groupe: { id: string; name: string; classe: { name: string }; serie: { name: string } | null } | null;
};

function toChildDTO(student: ChildRecord) {
  return {
    id: student.id,
    matricule: student.matricule,
    fullName: student.fullName,
    groupeId: student.groupeId,
    groupe: student.groupe ? { id: student.groupe.id, name: student.groupe.name } : null,
    groupeLabel: composeGroupeLabel(student.groupe),
  };
}

// Élèves de CETTE école liés à ce compte Parent (fratrie éventuelle).
export async function listMyChildren(userId: string, schoolId: string) {
  const links = await prisma.studentGuardian.findMany({
    where: { userId, student: { schoolId } },
    include: { student: childSelect },
  });
  return links.map((l) => toChildDTO(l.student));
}

// Porte d'entrée unique de tout le module : vérifie que `userId` est bien
// déclaré parent/tuteur de `studentId`, ET que cet élève appartient bien à
// `schoolId` (un parent d'une autre école ne doit rien pouvoir déduire en
// changeant l'id d'école dans l'URL). Lève `forbidden` sinon — jamais de
// fuite d'information sur l'existence de l'élève à un utilisateur non lié.
export async function assertGuardianOfStudent(userId: string, schoolId: string, studentId: string) {
  const link = await prisma.studentGuardian.findFirst({
    where: { userId, studentId, student: { schoolId } },
    include: { student: childSelect },
  });
  if (!link) throw ApiError.forbidden("Vous n'êtes pas le parent/tuteur déclaré de cet élève.");
  return link.student;
}

// Résumé en lecture seule d'un élève pour son parent : présences (historique
// complet, réutilise attendance.service.ts::listAllAttendance déjà filtrable
// par studentId — pas `listAttendance`, paginé, réservé à l'endpoint HTTP
// `GET /attendance`), frais de scolarité (réutilise enrollments.service.ts::
// listAllEnrollments), et bulletin du trimestre demandé si l'élève est affecté
// à une classe (réutilise grades.service.ts::getStudentBulletin — capturé
// en `null` plutôt que de faire échouer tout le résumé si aucune note
// n'existe encore pour ce trimestre, cas normal en début d'année).
export async function getChildSummary(
  userId: string,
  schoolId: string,
  studentId: string,
  opts: { trimestre?: number; schoolYearId?: string }
) {
  const student = await assertGuardianOfStudent(userId, schoolId, studentId);

  const [attendance, enrollments, bulletin] = await Promise.all([
    listAllAttendance(schoolId, { studentId }),
    listAllEnrollments(schoolId, { studentId, schoolYearId: opts.schoolYearId }),
    student.groupeId && opts.trimestre
      ? getStudentBulletin(schoolId, studentId, opts.trimestre).catch(() => null)
      : Promise.resolve(null),
  ]);

  return { student: toChildDTO(student), attendance, enrollments, bulletin };
}

// Itération 72 — module Phase 2b (emploi du temps mobile). Ajout additif :
// aucune route/fonction existante modifiée. Réutilise TEL QUEL
// timetable.service.ts::listTimetable (déjà utilisé par le personnel via
// GET /schools/:schoolId/timetable), filtré sur le SEUL `groupeId` de
// l'élève — jamais de `scope` enseignant ici (non pertinent pour un compte
// Parent). `student.groupeId` peut être `null` (élève pas encore affecté à
// une classe) : renvoyer un tableau vide plutôt que d'interroger
// `listTimetable` avec un `groupeId` absent, qui renverrait alors TOUT
// l'emploi du temps de l'école — fuite d'information hors du périmètre
// strict de cet enfant.
export async function getChildTimetable(userId: string, schoolId: string, studentId: string) {
  const student = await assertGuardianOfStudent(userId, schoolId, studentId);
  if (!student.groupeId) return [];
  return listTimetable(schoolId, { groupeId: student.groupeId });
}
