import { prisma, AttendanceStatus } from "../../config/prisma";
import { getStudentBulletin } from "../grades/grades.service";
import { composeGroupeLabel, groupeWithLabelSelect } from "../../utils/groupeLabel";
import type {
  StudentNetworkAttendanceDTO,
  StudentNetworkEndOfYearDTO,
  StudentNetworkEntryDTO,
  StudentNetworkFinanceRowDTO,
  StudentNetworkSearchResult,
} from "./student-network.types";

// ----------------------------------------------------------------------------
// Itération 46 — module INTENTIONNELLEMENT différent de tous les autres de ce
// projet : c'est le SEUL endroit qui interroge le modèle `Student` SANS
// filtrer par `schoolId`. Cadrage explicite de l'utilisateur (AskUserQuestion)
// : "chaque établissement peut effectuer des recherches sur élève et
// retrouver son parcours à travers les différents établissements à partir de
// l'un de ses numéros" — un élève identifié par son numéro de carte
// d'identité nationale ou son numéro d'élève (ministère) peut avoir une
// fiche `Student` distincte dans PLUSIEURS écoles (transfert, double
// inscription) ; cette recherche les retrouve TOUTES et assemble, pour
// chacune, un dossier complet (choix explicite de l'utilisateur : "Dossier
// complet" plutôt qu'un simple résumé — notes/bulletins, présences,
// paiements des AUTRES écoles sont donc bien exposés ici, alors qu'ils
// restent strictement cloisonnés par école PARTOUT ailleurs dans
// l'application). Restreint aux rôles ADMIN/GESTION_ELEVES au niveau route
// (voir student-network.routes.ts) — jamais un accès plus large que celui
// qui gère déjà les élèves au sein d'une école.
// ----------------------------------------------------------------------------

// `composeGroupeLabel`/`groupeWithLabelSelect` désormais partagés — voir
// utils/groupeLabel.ts (extrait à l'itération 113, ce module en était
// l'origine à l'itération 46).

async function buildEndOfYearHistory(studentId: string): Promise<StudentNetworkEndOfYearDTO[]> {
  const decisions = await prisma.endOfYearDecision.findMany({
    where: { studentId },
    include: {
      schoolYear: { select: { label: true, order: true } },
      originGroupe: groupeWithLabelSelect,
      targetGroupe: groupeWithLabelSelect,
    },
    orderBy: { schoolYear: { order: "desc" } },
  });
  return decisions.map((d) => ({
    schoolYearLabel: d.schoolYear.label,
    decision: d.decision,
    originGroupeLabel: composeGroupeLabel(d.originGroupe),
    targetGroupeLabel: composeGroupeLabel(d.targetGroupe),
    note: d.note,
    createdAt: d.decidedAt.toISOString(),
  }));
}

// Bulletins par trimestre — réutilise `getStudentBulletin` (grades.service.ts)
// TEL QUEL, jamais un second calcul de moyenne/mention qui pourrait diverger
// de celui déjà affiché à l'école d'origine (même principe que
// `computeClassAverages` réutilisée par end-of-year.service.ts). Un élève
// sans classe (`groupeId` nul, ex. un élève déjà parti) n'a simplement aucun
// bulletin à présenter — `getStudentBulletin` lèverait sinon une erreur.
async function buildBulletins(schoolId: string, studentId: string, groupeId: string | null) {
  if (!groupeId) return [];
  const params = await prisma.schoolParameters.findUnique({ where: { schoolId }, select: { nbTrimestres: true } });
  const nbTrimestres = params?.nbTrimestres ?? 3;
  const trimestres = Array.from({ length: nbTrimestres }, (_, i) => i + 1);
  const bulletins = await Promise.all(
    trimestres.map(async (trimestre) => {
      const bulletin = await getStudentBulletin(schoolId, studentId, trimestre);
      return {
        trimestre,
        average: bulletin.average,
        rank: bulletin.rank,
        classSize: bulletin.classSize,
        mention: bulletin.mention,
      };
    })
  );
  return bulletins;
}

// Présences — agrégat PAR ÉLÈVE, délibérément distinct de
// `attendance.service.ts::getAttendanceStats` (qui calcule le même total
// mais pour TOUS les élèves d'UNE classe à la fois) : ici on ne veut jamais
// charger la classe entière d'une autre école pour n'en garder qu'une seule
// ligne. Même formule de taux de présence (RETARD compte comme "présent").
async function buildAttendanceSummary(studentId: string): Promise<StudentNetworkAttendanceDTO> {
  const records = await prisma.attendanceRecord.findMany({ where: { studentId }, select: { status: true } });
  const present = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
  const absent = records.filter((r) => r.status === AttendanceStatus.ABSENT).length;
  const retard = records.filter((r) => r.status === AttendanceStatus.RETARD).length;
  const total = present + absent + retard;
  return { present, absent, retard, total, tauxPresence: total > 0 ? ((present + retard) / total) * 100 : null };
}

async function buildFinanceHistory(studentId: string): Promise<{
  enrollments: StudentNetworkFinanceRowDTO[];
  tuitionFees: StudentNetworkFinanceRowDTO[];
}> {
  const [enrollments, tuitionFees] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId },
      include: { schoolYear: { select: { label: true, order: true } } },
      orderBy: { schoolYear: { order: "desc" } },
    }),
    prisma.tuitionFee.findMany({
      where: { studentId },
      include: { schoolYear: { select: { label: true, order: true } } },
      orderBy: [{ schoolYear: { order: "desc" } }, { month: "asc" }],
    }),
  ]);
  return {
    enrollments: enrollments.map((e) => ({
      schoolYearLabel: e.schoolYear.label,
      month: null,
      amountDue: Number(e.feeDue),
      amountPaid: Number(e.amountPaid),
      discountAmount: Number(e.discountAmount),
      status: e.status,
    })),
    tuitionFees: tuitionFees.map((t) => ({
      schoolYearLabel: t.schoolYear.label,
      month: t.month,
      amountDue: Number(t.amountDue),
      amountPaid: Number(t.amountPaid),
      discountAmount: Number(t.discountAmount),
      status: t.status,
    })),
  };
}

async function buildEntry(student: {
  id: string;
  schoolId: string;
  fullName: string;
  birthDate: Date | null;
  birthPlace: string | null;
  sex: string | null;
  matricule: string;
  nationalIdNumber: string | null;
  ministryStudentNumber: string | null;
  groupeId: string | null;
  school: { name: string; island: string | null };
  groupe: { name: string; classe: { name: string }; serie: { name: string } | null } | null;
}): Promise<StudentNetworkEntryDTO> {
  const [endOfYearDecisions, bulletins, attendance, finance] = await Promise.all([
    buildEndOfYearHistory(student.id),
    buildBulletins(student.schoolId, student.id, student.groupeId),
    buildAttendanceSummary(student.id),
    buildFinanceHistory(student.id),
  ]);

  return {
    studentId: student.id,
    schoolId: student.schoolId,
    schoolName: student.school.name,
    schoolIsland: student.school.island,
    fullName: student.fullName,
    birthDate: student.birthDate ? student.birthDate.toISOString() : null,
    birthPlace: student.birthPlace,
    sex: student.sex,
    matricule: student.matricule,
    nationalIdNumber: student.nationalIdNumber,
    ministryStudentNumber: student.ministryStudentNumber,
    classeLabel: composeGroupeLabel(student.groupe),
    endOfYearDecisions,
    bulletins,
    attendance,
    enrollments: finance.enrollments,
    tuitionFees: finance.tuitionFees,
  };
}

// Point d'entrée — délibérément SANS paramètre `schoolId` de filtrage (voir
// le commentaire d'en-tête ci-dessus) : `schoolId` de l'appelant ne sert
// qu'à l'autorisation côté route/contrôleur, jamais à restreindre cette
// requête elle-même.
export async function searchStudentNetwork(
  field: "nationalIdNumber" | "ministryStudentNumber",
  value: string
): Promise<StudentNetworkSearchResult> {
  const students = await prisma.student.findMany({
    where: { [field]: value },
    include: {
      school: { select: { name: true, island: true } },
      groupe: groupeWithLabelSelect,
    },
    orderBy: { createdAt: "desc" },
  });

  const matches = await Promise.all(students.map((s) => buildEntry(s)));
  return { field, value, matches };
}
