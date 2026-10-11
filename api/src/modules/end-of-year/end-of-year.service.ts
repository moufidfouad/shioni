import { prisma, EndOfYearDecisionType } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { assertGroupeInScope, TeacherScope } from "../../utils/teacherScope";
import { buildPaginationMeta, PaginationQuery, toSkipTake } from "../../utils/pagination";
import { computeClassAverages } from "../grades/grades.service";
// Réutilisée telle quelle plutôt que dupliquée — même règle "le statut ne se
// saisit jamais à la main, il découle toujours des montants" que pour toute
// inscription créée à la main (voir enrollments.service.ts).
import { computeStatus } from "../enrollments/enrollments.service";
import type { EndOfYearDecisionInput } from "./end-of-year.schema";

const studentSelect = {
  select: { id: true, matricule: true, fullName: true, groupeId: true },
} as const;

const groupeSelect = { select: { id: true, name: true } } as const;
const schoolYearSelect = { select: { id: true, label: true } } as const;

async function assertStudentInSchool(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
  if (!student) throw ApiError.notFound("Élève introuvable dans cette école.");
  return student;
}

async function assertGroupeInSchool(schoolId: string, groupeId: string) {
  const groupe = await prisma.groupe.findFirst({ where: { id: groupeId, schoolId } });
  if (!groupe) throw ApiError.notFound("Classe introuvable dans cette école.");
  return groupe;
}

async function assertSchoolYearInSchool(schoolId: string, schoolYearId: string) {
  const year = await prisma.schoolYear.findFirst({ where: { id: schoolYearId, schoolId } });
  if (!year) throw ApiError.notFound("Année scolaire introuvable dans cette école.");
  return year;
}

// Barème (FeeLevel) de la classe d'un groupe — sert à préremplir le montant
// de l'inscription générée automatiquement par PASSAGE/REDOUBLEMENT (cadrage
// AskUserQuestion, itération 44 : barème de la classe CIBLE de l'élève après
// la décision). `0` si le groupe n'a pas encore de barème configuré, ou si
// l'élève n'a pas de groupe résolu (edge case) — l'inscription est alors
// créée avec un `feeDue` à 0, librement modifiable ensuite comme toute
// inscription (même philosophie que `discountAmount`).
// `tx: any` — même choix que le reste du projet pour un paramètre de
// transaction (voir "Points établis à respecter" du doc d'architecture) :
// le client Prisma généré n'existe pas dans ce bac à sable, un stub de
// vérification locale le remplace, et le type exact de `Prisma.
// TransactionClient` (paramètre implicite du callback `$transaction`)
// n'a jamais besoin d'être reproduit explicitement ailleurs dans ce projet.
async function resolveFeeLevelAmount(tx: any, groupeId: string | null): Promise<number> {
  if (!groupeId) return 0;
  const groupe = await tx.groupe.findUnique({ where: { id: groupeId }, select: { classeId: true } });
  if (!groupe) return 0;
  const feeLevel = await tx.feeLevel.findUnique({ where: { classeId: groupe.classeId }, select: { amount: true } });
  return feeLevel ? Number(feeLevel.amount) : 0;
}

// Moyenne annuelle = moyenne ARITHMÉTIQUE des moyennes de trimestre
// effectivement renseignées (via `computeClassAverages`, grades.service.ts —
// même moyenne pondérée par coefficient que celle déjà affichée sur le
// bulletin, pas un second calcul qui pourrait diverger). PAS un recalcul
// unique sur toutes les évaluations de l'année : le modèle `Grade` n'a
// d'ailleurs aucune notion d'année scolaire (seul `trimestre` existe, voir
// schema.prisma) — une limitation pré-existante du module Notes, pas propre
// à cette itération, qui borne déjà implicitement tout calcul de moyenne aux
// seules données actuellement en base, sans distinction d'année. Un
// trimestre sans la moindre note pour l'élève est ignoré plutôt que compté
// comme 0 (même principe que `computeClassAverages`), et un élève sans
// AUCUNE moyenne de trimestre obtient `null` (pas encore évaluable).
async function computeAnnualAverages(schoolId: string, groupeId: string, nbTrimestres: number) {
  const perTrimestre = await Promise.all(
    Array.from({ length: nbTrimestres }, (_, i) => i + 1).map((t) => computeClassAverages(schoolId, groupeId, t))
  );

  const byStudent = new Map<
    string,
    { student: { id: string; matricule: string; fullName: string }; averages: number[] }
  >();
  for (const rows of perTrimestre) {
    for (const row of rows) {
      const entry = byStudent.get(row.student.id) ?? { student: row.student, averages: [] as number[] };
      if (row.average !== null) entry.averages.push(row.average);
      byStudent.set(row.student.id, entry);
    }
  }

  return [...byStudent.values()].map(({ student, averages }) => ({
    student,
    annualAverage: averages.length ? averages.reduce((a, b) => a + b, 0) / averages.length : null,
  }));
}

// Ne suggère JAMAIS DEPART ni REORIENTATION — ce sont des décisions externes
// aux notes (départ vers un autre établissement, choix d'orientation) que
// rien dans les moyennes ne peut deviner. Réutilise tel quel le seuil déjà
// existant `SchoolParameters.notePassage` (choix (2) de l'itération 43,
// voir "Décisions prises") plutôt que d'ajouter un second champ de seuil qui
// pourrait diverger de celui déjà utilisé par `computeMention` pour la
// mention "Passable"/"Insuffisant" d'un trimestre.
function suggestDecision(annualAverage: number | null, notePassage: unknown): EndOfYearDecisionType | null {
  if (annualAverage === null) return null;
  return annualAverage >= Number(notePassage) ? EndOfYearDecisionType.PASSAGE : EndOfYearDecisionType.REDOUBLEMENT;
}

// Vue de travail "conseil de classe" : pour chaque élève d'un groupe, sa
// moyenne annuelle, la décision suggérée, et sa décision déjà enregistrée
// pour cette année scolaire le cas échéant — le personnel reste libre de
// suivre ou d'ignorer la suggestion avant d'enregistrer (voir upsertDecision,
// jamais appliqué automatiquement).
export async function getOverview(
  schoolId: string,
  groupeId: string,
  schoolYearId: string,
  scope: TeacherScope | null = null
) {
  if (scope) assertGroupeInScope(scope, groupeId);
  await assertGroupeInSchool(schoolId, groupeId);

  const params = await prisma.schoolParameters.findUnique({ where: { schoolId } });
  if (!params) throw ApiError.notFound("Paramètres introuvables pour cette école.");

  const [averages, decisions] = await Promise.all([
    computeAnnualAverages(schoolId, groupeId, params.nbTrimestres),
    prisma.endOfYearDecision.findMany({
      where: { schoolYearId, student: { schoolId, groupeId } },
      include: { targetGroupe: groupeSelect, enrollmentSchoolYear: schoolYearSelect },
    }),
  ]);

  const decisionByStudent = new Map(decisions.map((d) => [d.studentId, d]));

  return averages
    .map(({ student, annualAverage }) => {
      const decision = decisionByStudent.get(student.id) ?? null;
      return {
        student,
        annualAverage,
        suggestedDecision: suggestDecision(annualAverage, params.notePassage),
        decision: decision
          ? {
              id: decision.id,
              decision: decision.decision,
              targetGroupeId: decision.targetGroupeId,
              targetGroupeName: decision.targetGroupe?.name ?? null,
              // Itération 44 — pré-remplissage de la correction : l'année
              // d'inscription déjà choisie la fois précédente (le cas
              // échéant), jamais déduite silencieusement (voir
              // end-of-year.schema.ts).
              enrollmentSchoolYearId: decision.enrollmentSchoolYearId,
              enrollmentSchoolYearLabel: decision.enrollmentSchoolYear?.label ?? null,
              generatedEnrollmentId: decision.generatedEnrollmentId,
              note: decision.note,
              decidedAt: decision.decidedAt,
            }
          : null,
      };
    })
    .sort((a, b) => a.student.fullName.localeCompare(b.student.fullName));
}

// Cartes de stats — `groupeId` respecté dès cette première itération (leçon
// des itérations 40/41 : une page qui affiche à la fois un agrégat et une
// liste/vue filtrable doit propager EXACTEMENT le même filtre aux deux,
// jamais ajouté après coup une fois le bug constaté).
export async function getStats(schoolId: string, schoolYearId: string, groupeId?: string) {
  const [totalStudents, decisions] = await Promise.all([
    prisma.student.count({ where: { schoolId, groupeId: groupeId || undefined } }),
    prisma.endOfYearDecision.findMany({
      where: { schoolYearId, student: { schoolId, groupeId: groupeId || undefined } },
      select: { decision: true },
    }),
  ]);

  const countByType = (type: EndOfYearDecisionType) => decisions.filter((d) => d.decision === type).length;

  return {
    totalStudents,
    decided: decisions.length,
    pending: totalStudents - decisions.length,
    passage: countByType(EndOfYearDecisionType.PASSAGE),
    redoublement: countByType(EndOfYearDecisionType.REDOUBLEMENT),
    depart: countByType(EndOfYearDecisionType.DEPART),
    reorientation: countByType(EndOfYearDecisionType.REORIENTATION),
  };
}

export interface EndOfYearFilters {
  schoolYearId?: string;
  decision?: EndOfYearDecisionType;
  groupeId?: string;
  search?: string;
}

function buildEndOfYearWhere(schoolId: string, opts: EndOfYearFilters) {
  return {
    schoolYearId: opts.schoolYearId || undefined,
    decision: opts.decision || undefined,
    student: {
      schoolId,
      groupeId: opts.groupeId || undefined,
      fullName: opts.search ? { contains: opts.search, mode: "insensitive" as const } : undefined,
    },
  };
}

// Rapport transversal (toutes classes) — vue "par classe" (getOverview)
// couverte séparément pour le workflow de saisie du conseil de classe.
export async function listDecisions(schoolId: string, opts: EndOfYearFilters, pagination: PaginationQuery) {
  const where = buildEndOfYearWhere(schoolId, opts);
  const [data, total] = await Promise.all([
    prisma.endOfYearDecision.findMany({
      where,
      include: {
        student: studentSelect,
        targetGroupe: groupeSelect,
        originGroupe: groupeSelect,
        schoolYear: schoolYearSelect,
        enrollmentSchoolYear: schoolYearSelect,
      },
      orderBy: [{ schoolYear: { order: "desc" } }, { student: { fullName: "asc" } }],
      ...toSkipTake(pagination),
    }),
    prisma.endOfYearDecision.count({ where }),
  ]);
  return { data, pagination: buildPaginationMeta(total, pagination) };
}

export async function getDecision(schoolId: string, decisionId: string) {
  const decision = await prisma.endOfYearDecision.findFirst({
    where: { id: decisionId, student: { schoolId } },
    include: {
      student: studentSelect,
      targetGroupe: groupeSelect,
      originGroupe: groupeSelect,
      schoolYear: schoolYearSelect,
      enrollmentSchoolYear: schoolYearSelect,
    },
  });
  if (!decision) throw ApiError.notFound("Décision de fin d'année introuvable.");
  return decision;
}

// Détermine l'effet réel sur `Student.groupeId` (choix (1) de l'itération
// 43 — voir "Décisions prises") : `undefined` = ne touche pas au groupe de
// l'élève (cas DEPART, volontairement — étiquette informative seulement,
// choix (3)). PASSAGE/REORIENTATION imposent `targetGroupeId` (exigé par
// `endOfYearDecisionSchema`) ; REDOUBLEMENT retombe sur `originGroupeId` (le
// groupe de l'élève tel qu'il était AVANT cette décision, capturé une seule
// fois à la création — voir schema.prisma) si aucune destination explicite
// n'est fournie.
//
// Cas limite assumé, documenté plutôt que corrigé : corriger une décision
// PASSAGE (qui a déjà déplacé l'élève vers `targetGroupeId`) en DEPART ne
// revient PAS automatiquement sur ce déplacement — DEPART ne touchant
// jamais `Student.groupeId`, l'élève reste dans le groupe où le PASSAGE
// erroné l'avait placé. Un correctif manuel du groupe de l'élève (page
// Élèves) reste nécessaire dans ce cas précis, jugé assez rare pour ne pas
// justifier de logique de réconciliation supplémentaire dans cette
// itération.
function resolveGroupeEffect(
  decision: EndOfYearDecisionType,
  targetGroupeId: string | null,
  originGroupeId: string | null
): string | null | undefined {
  switch (decision) {
    case EndOfYearDecisionType.PASSAGE:
    case EndOfYearDecisionType.REORIENTATION:
      return targetGroupeId;
    case EndOfYearDecisionType.REDOUBLEMENT:
      return targetGroupeId ?? originGroupeId;
    case EndOfYearDecisionType.DEPART:
    default:
      return undefined;
  }
}

// Upsert par clé métier (studentId, schoolYearId) — PAS un CRUD create/update
// classique par id généré : à la différence d'`Enrollment` (plusieurs
// lignes légitimes par élève/année), il n'existe ici aucun flux métier
// légitime pour deux décisions du même élève la même année (contrainte
// réellement imposée en base, `@@unique`, même principe que `TuitionFee`) —
// une correction MET À JOUR la ligne existante. Ce choix colle aussi mieux
// au workflow réel : le personnel enregistre/corrige la décision d'un élève
// plusieurs fois pendant une même séance de conseil de classe avant de
// passer au suivant, sans avoir à distinguer lui-même "créer" de "corriger".
export async function upsertDecision(schoolId: string, input: EndOfYearDecisionInput) {
  const student = await assertStudentInSchool(schoolId, input.studentId);
  await assertSchoolYearInSchool(schoolId, input.schoolYearId);
  if (input.targetGroupeId) await assertGroupeInSchool(schoolId, input.targetGroupeId);
  if (input.enrollmentSchoolYearId) await assertSchoolYearInSchool(schoolId, input.enrollmentSchoolYearId);

  const existing = await prisma.endOfYearDecision.findFirst({
    where: { studentId: input.studentId, schoolYearId: input.schoolYearId },
  });

  return prisma.$transaction(async (tx) => {
    // Capturé UNE SEULE FOIS, à la toute première création — jamais
    // recalculé sur une correction ultérieure (voir le commentaire sur
    // `EndOfYearDecision.originGroupeId` dans schema.prisma).
    const originGroupeId = existing ? existing.originGroupeId : student.groupeId;

    const decision = existing
      ? await tx.endOfYearDecision.update({
          where: { id: existing.id },
          data: {
            decision: input.decision,
            targetGroupeId: input.targetGroupeId ?? null,
            enrollmentSchoolYearId: input.enrollmentSchoolYearId ?? null,
            note: input.note ?? null,
          },
          include: { targetGroupe: groupeSelect, originGroupe: groupeSelect, student: studentSelect },
        })
      : await tx.endOfYearDecision.create({
          data: {
            studentId: input.studentId,
            schoolYearId: input.schoolYearId,
            decision: input.decision,
            originGroupeId,
            targetGroupeId: input.targetGroupeId ?? null,
            enrollmentSchoolYearId: input.enrollmentSchoolYearId ?? null,
            note: input.note ?? null,
          },
          include: { targetGroupe: groupeSelect, originGroupe: groupeSelect, student: studentSelect },
        });

    const groupeEffect = resolveGroupeEffect(input.decision, input.targetGroupeId ?? null, originGroupeId);
    if (groupeEffect !== undefined) {
      await tx.student.update({ where: { id: input.studentId }, data: { groupeId: groupeEffect } });
    }

    // ---- Itération 44 — inscription automatique (demande utilisateur) ----
    // "si passage en classe supérieure validée, l'élève est inscrit pour
    // l'année suivante et doit donc un frais d'inscription. Si redoublement,
    // de même." Effet réel immédiat (cadrage AskUserQuestion), mais SEULEMENT
    // à la toute première fois pour CETTE décision : `generatedEnrollmentId`
    // (voir schema.prisma) rend cette étape idempotente sur une correction
    // ultérieure — jamais une seconde inscription générée pour la même
    // décision, même si le personnel corrige la note, la classe cible, ou
    // bascule entre PASSAGE et REDOUBLEMENT ensuite (l'inscription déjà
    // créée n'est alors ni supprimée ni re-calculée sur le nouveau groupe —
    // un correctif manuel via la page Inscriptions reste nécessaire dans ce
    // cas, même limitation assumée que documentée sur `Student.groupeId`
    // plus haut). REORIENTATION/DEPART n'atteignent jamais ce bloc : la
    // validation zod interdit `enrollmentSchoolYearId` pour ces deux
    // décisions (voir end-of-year.schema.ts).
    let generatedEnrollmentId: string | null = existing?.generatedEnrollmentId ?? null;
    const needsEnrollment =
      (input.decision === EndOfYearDecisionType.PASSAGE || input.decision === EndOfYearDecisionType.REDOUBLEMENT) &&
      Boolean(input.enrollmentSchoolYearId);

    if (needsEnrollment && !generatedEnrollmentId) {
      // Même garde-fou anti-doublon qu'`enrollments.service.ts::
      // createEnrollment` : si une inscription existe déjà pour cet élève
      // et cette année (créée à la main avant la décision, ou par une
      // correction concurrente), on la RÉFÉRENCE plutôt que d'en créer une
      // seconde — jamais de doublon silencieux.
      const alreadyEnrolled = await tx.enrollment.findFirst({
        where: { studentId: input.studentId, schoolYearId: input.enrollmentSchoolYearId! },
      });
      if (alreadyEnrolled) {
        generatedEnrollmentId = alreadyEnrolled.id;
      } else {
        const feeDue = await resolveFeeLevelAmount(tx, groupeEffect ?? null);
        const enrollment = await tx.enrollment.create({
          data: {
            studentId: input.studentId,
            schoolYearId: input.enrollmentSchoolYearId!,
            feeDue,
            amountPaid: 0,
            status: computeStatus(feeDue, 0),
          },
        });
        generatedEnrollmentId = enrollment.id;
      }
      await tx.endOfYearDecision.update({ where: { id: decision.id }, data: { generatedEnrollmentId } });
    }

    return { ...decision, generatedEnrollmentId };
  });
}

// Supprime la décision SEULE — ne revient JAMAIS automatiquement sur l'effet
// déjà appliqué à `Student.groupeId`, ni sur l'inscription éventuellement
// générée (`generatedEnrollmentId`, itération 44 — voir upsertDecision ci-
// dessus) : même philosophie que `discountAmount`, itération 25 : une valeur
// déclarative une fois appliquée n'est jamais recalculée/annulée en cascade
// par un simple retrait de la ligne qui l'a produite. Un correctif manuel du
// groupe de l'élève (page Élèves) ou de l'inscription (page Inscriptions)
// reste possible si nécessaire.
export async function deleteDecision(schoolId: string, decisionId: string) {
  const decision = await getDecision(schoolId, decisionId);
  await prisma.endOfYearDecision.delete({ where: { id: decision.id } });
}
