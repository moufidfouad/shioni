import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { assertGroupeInScope, assertGroupeSubjectInScope, TeacherScope } from "../../utils/teacherScope";
import { buildPaginationMeta, PaginationQuery, toSkipTake } from "../../utils/pagination";
import { intersectGroupeIds, resolveGroupeIds, StructureFilter } from "../../utils/structureFilter";
import { getTokensForUsers } from "../push-tokens/push-tokens.service";
import { sendExpoPushNotifications, ExpoPushMessage } from "../../utils/expoPush";
import type {
  BulkGradeEvaluationInput,
  DeleteEvaluationInput,
  GradeInput,
  UpdateGradeInput,
} from "./grades.schema";

const studentSelect = {
  select: { id: true, matricule: true, fullName: true, groupeId: true },
} as const;

const subjectSelect = {
  select: { id: true, name: true },
} as const;

const evaluationsOrder = { orderBy: { order: "asc" as const } };

type EvaluationLike = { value: unknown; weight: unknown };

// Moyenne PONDÉRÉE de la matière pour le trimestre : Σ(valeur × poids) /
// Σ(poids) sur les évaluations réellement saisies — remplace la moyenne
// arithmétique simple de note1/2/3 (avant cette itération). `null` si
// aucune évaluation n'a encore été saisie, pour distinguer "pas encore
// noté" de "note de 0". Les poids sont des valeurs RELATIVES (voir
// grades.schema.ts) : pas besoin qu'ils somment à 100, la division par
// Σ(poids) normalise d'elle-même — un trimestre où seul "Devoir" (poids 25)
// est saisi et pas encore "Composition" (poids 75) donne donc la moyenne du
// Devoir seul, pas une moyenne écrasée par un poids "manquant".
// Exportée (itération 35) pour être réutilisée par le module `analytics`
// (moyenne par classe/série/groupe) sans dupliquer le calcul.
export function computeAverage(evaluations: EvaluationLike[]): number | null {
  if (!evaluations || evaluations.length === 0) return null;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const evaluation of evaluations) {
    const value = Number(evaluation.value);
    const weight = Number(evaluation.weight);
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) continue;
    weightedSum += value * weight;
    totalWeight += weight;
  }
  if (totalWeight <= 0) return null;
  return weightedSum / totalWeight;
}

function computeMention(
  average: number | null,
  params: { notePassage: unknown; seuilBien: unknown; seuilTresBien: unknown; seuilExcellent: unknown }
): string | null {
  if (average === null) return null;
  if (average >= Number(params.seuilExcellent)) return "Excellent";
  if (average >= Number(params.seuilTresBien)) return "Très bien";
  if (average >= Number(params.seuilBien)) return "Bien";
  if (average >= Number(params.notePassage)) return "Passable";
  return "Insuffisant";
}

async function assertStudentInSchool(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
  if (!student) throw ApiError.notFound("Élève introuvable dans cette école.");
  return student;
}

async function assertSubjectInSchool(schoolId: string, subjectId: string) {
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId } });
  if (!subject) throw ApiError.notFound("Matière introuvable dans cette école.");
  return subject;
}

async function assertGroupeInSchool(schoolId: string, groupeId: string) {
  const groupe = await prisma.groupe.findFirst({ where: { id: groupeId, schoolId } });
  if (!groupe) throw ApiError.notFound("Classe introuvable dans cette école.");
  return groupe;
}

export interface GradeFilters extends StructureFilter {
  subjectId?: string;
  trimestre?: number;
  studentId?: string;
}

export async function listGrades(
  schoolId: string,
  opts: GradeFilters,
  scope: TeacherScope | null = null,
  pagination: PaginationQuery
) {
  // Itération 29 : un compte Enseignant scopé qui précise groupeId (et
  // souvent subjectId, voir GradeEntry côté frontend) doit enseigner
  // effectivement cette classe/matière ; s'il ne précise pas de classe (cas
  // rare, pas utilisé aujourd'hui par le frontend), on restreint la requête
  // à ses seules classes plutôt que de renvoyer une erreur.
  if (scope) {
    if (opts.groupeId && opts.subjectId) {
      assertGroupeSubjectInScope(scope, opts.groupeId, opts.subjectId);
    } else if (opts.groupeId) {
      assertGroupeInScope(scope, opts.groupeId);
    }
  }
  // Itération 35 — filtres par cycle/classe/série en plus du groupeId
  // (résolus via resolveGroupeIds), combinés à la portée Enseignant.
  const structureGroupeIds = await resolveGroupeIds(schoolId, opts);
  const scopeGroupeIds = scope ? Array.from(scope.groupeIds) : undefined;
  const finalGroupeIds = intersectGroupeIds(structureGroupeIds, scopeGroupeIds);
  const groupeFilter = finalGroupeIds ? { in: finalGroupeIds } : undefined;

  // `where` extrait dans une variable locale, réutilisée à l'identique par
  // le `findMany` (page courante) et le `count` (total) ci-dessous.
  const where = {
    subjectId: opts.subjectId || undefined,
    trimestre: opts.trimestre || undefined,
    studentId: opts.studentId || undefined,
    student: { schoolId, groupeId: groupeFilter },
  };

  const [grades, total] = await Promise.all([
    prisma.grade.findMany({
      where,
      include: { student: studentSelect, subject: subjectSelect, evaluations: evaluationsOrder },
      orderBy: [{ trimestre: "asc" }, { student: { fullName: "asc" } }],
      ...toSkipTake(pagination),
    }),
    prisma.grade.count({ where }),
  ]);

  return {
    data: grades.map((g) => ({ ...g, average: computeAverage(g.evaluations) })),
    pagination: buildPaginationMeta(total, pagination),
  };
}

export async function getGrade(schoolId: string, gradeId: string, scope: TeacherScope | null = null) {
  const grade = await prisma.grade.findFirst({
    where: { id: gradeId, student: { schoolId } },
    include: { student: studentSelect, subject: subjectSelect, evaluations: evaluationsOrder },
  });
  if (!grade) throw ApiError.notFound("Note introuvable.");
  if (scope) assertGroupeSubjectInScope(scope, grade.student.groupeId ?? "", grade.subjectId);
  return { ...grade, average: computeAverage(grade.evaluations) };
}

export async function createGrade(schoolId: string, input: GradeInput, scope: TeacherScope | null = null) {
  const student = await assertStudentInSchool(schoolId, input.studentId);
  await assertSubjectInSchool(schoolId, input.subjectId);
  if (scope) assertGroupeSubjectInScope(scope, student.groupeId ?? "", input.subjectId);

  // Pas de contrainte d'unicité en base sur (studentId, subjectId,
  // trimestre) — comme pour les inscriptions (itération 10), on prévient le
  // doublon involontaire au niveau service plutôt qu'en base.
  const existing = await prisma.grade.findFirst({
    where: { studentId: input.studentId, subjectId: input.subjectId, trimestre: input.trimestre },
  });
  if (existing) throw ApiError.conflict("Une note existe déjà pour cet élève, cette matière et ce trimestre.");

  const grade = await prisma.grade.create({
    data: {
      studentId: input.studentId,
      subjectId: input.subjectId,
      trimestre: input.trimestre,
      evaluations: {
        create: input.evaluations.map((e, index) => ({ label: e.label, value: e.value, weight: e.weight, order: index })),
      },
    },
    include: { student: studentSelect, subject: subjectSelect, evaluations: evaluationsOrder },
  });
  return { ...grade, average: computeAverage(grade.evaluations) };
}

// Remplace ENTIÈREMENT la liste des évaluations d'un `Grade` (voir le
// commentaire de `updateGradeSchema`) : on supprime les évaluations
// existantes puis on recrée celles du payload, dans une transaction pour
// que l'opération reste atomique (jamais un état intermédiaire "0
// évaluation" visible par une autre requête concurrente).
export async function updateGrade(
  schoolId: string,
  gradeId: string,
  input: UpdateGradeInput,
  scope: TeacherScope | null = null
) {
  await getGrade(schoolId, gradeId, scope);

  const grade = await prisma.$transaction(async (tx) => {
    await tx.gradeEvaluation.deleteMany({ where: { gradeId } });
    return tx.grade.update({
      where: { id: gradeId },
      data: {
        evaluations: {
          create: input.evaluations.map((e, index) => ({ label: e.label, value: e.value, weight: e.weight, order: index })),
        },
      },
      include: { student: studentSelect, subject: subjectSelect, evaluations: evaluationsOrder },
    });
  });
  return { ...grade, average: computeAverage(grade.evaluations) };
}

export async function deleteGrade(schoolId: string, gradeId: string, scope: TeacherScope | null = null) {
  await getGrade(schoolId, gradeId, scope);
  // `GradeEvaluation.gradeId` a `onDelete: Cascade` dans le schéma : ses
  // évaluations disparaissent avec lui, pas besoin de les supprimer à part.
  await prisma.grade.delete({ where: { id: gradeId } });
}

// Itération 110 — plan mobile Phase 3b (section 4.1), second et dernier
// déclencheur push envisagé dans ce document ("les notes/évaluations restent
// hors périmètre... un risque de fatigue de notification qui mérite sa
// propre réflexion plutôt qu'un copier-coller" du déclencheur d'absence,
// itération 87 — cadrage explicitement délégué à l'utilisateur, comme pour
// les absences). Décisions prises ICI, après cadrage :
//  - Périmètre choisi par l'utilisateur : "chaque note saisie OU modifiée"
//    — miroir exact du déclencheur d'absence, un push par élève dès qu'une
//    VALEUR réelle est enregistrée pour lui (création OU correction),
//    jamais sur une case laissée vide/retirée (`entry.value === null`, voir
//    la boucle ci-dessous — même exclusion que le "case laissée vide" déjà
//    documenté par `bulkGradeEvaluationSchema`, qui n'est pas "une nouvelle
//    information" à pousser). Le risque de fatigue identifié n'est PAS la
//    saisie en masse elle-même (chaque parent ne reçoit jamais qu'UN push
//    pour SON enfant, quelle que soit la taille de la classe) mais la
//    RÉPÉTITION sur un trimestre (plusieurs devoirs × plusieurs matières) —
//    accepté tel quel par l'utilisateur, à revisiter seulement si un usage
//    réel démontre une vraie gêne.
//  - Valeur numérique de la note délibérément OMISE du corps du push (à la
//    différence du statut d'absence, qui est binaire et déjà visible dans
//    tout l'écran de saisie) : une note reste une information par nature
//    plus sensible à exposer sur un écran verrouillé — le parent ouvre
//    l'application pour la consulter, le push se contente de signaler
//    l'événement (même logique de prudence que left implicite côté web, qui
//    n'affiche jamais de donnée notée dans une notification navigateur).
//  - Seul `bulkSetGradeEvaluation` déclenche : c'est le SEUL point d'entrée
//    d'écriture réellement câblé à une UI (web ET mobile, voir
//    `frontend/src/features/grades/api.ts`/`mobile/src/api/grades.ts`) —
//    `createGrade`/`updateGrade` (routes `POST /`/`PATCH /:gradeId`)
//    existent dans l'API mais ne sont appelés par aucun écran, ajouter un
//    déclencheur sur un chemin mort serait invérifiable et n'aurait aucun
//    effet réel avant qu'un futur écran ne les utilise.
//  - Même patron "best-effort" que `notifyAbsenceGuardians`
//    (attendance.service.ts) : jamais attendue par son appelant (pas
//    d'`await` au point d'appel), un échec d'envoi ne doit jamais faire
//    échouer ni ralentir la saisie de notes elle-même.
async function notifyGradeGuardians(
  schoolId: string,
  studentIds: string[],
  subjectName: string,
  label: string
): Promise<void> {
  if (studentIds.length === 0) return;
  try {
    const links = await prisma.studentGuardian.findMany({
      where: { studentId: { in: studentIds }, student: { schoolId } },
      include: { student: { select: { id: true, fullName: true } } },
    });
    if (links.length === 0) return;

    const guardianIds = Array.from(new Set(links.map((l) => l.userId)));
    const tokens = await getTokensForUsers(guardianIds);
    if (tokens.length === 0) return;

    const tokensByUser = new Map<string, string[]>();
    for (const t of tokens) {
      const list = tokensByUser.get(t.userId) ?? [];
      list.push(t.token);
      tokensByUser.set(t.userId, list);
    }

    const messages: ExpoPushMessage[] = [];
    for (const link of links) {
      const userTokens = tokensByUser.get(link.userId);
      if (!userTokens || userTokens.length === 0) continue;
      for (const token of userTokens) {
        messages.push({
          to: token,
          title: "Nouvelle note",
          body: `${link.student.fullName} a une nouvelle note en ${subjectName} (${label}).`,
          // `kind` distingue ce déclencheur de la Messagerie/des absences
          // côté mobile (voir mobile/src/lib/pushNotifications.ts) —
          // `studentId` permet de naviguer directement vers le bulletin de
          // l'enfant concerné (`children/[studentId]`), pas seulement
          // l'école. Pas de `value` dans `data` non plus, même raisonnement
          // que pour `body` ci-dessus.
          data: { schoolId, studentId: link.studentId, subjectName, kind: "grade" },
        });
      }
    }
    if (messages.length > 0) await sendExpoPushNotifications(messages);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[push] Échec de notification de note aux parents (ignoré) :", err);
  }
}

// Cœur de la saisie groupée : UNE évaluation (libellé + poids), une valeur
// par élève de la classe. Pas de contrainte d'unicité en base sur
// (gradeId, label) — on retrouve l'évaluation existante "à la main" (find
// puis create/update/delete), comme pour tous les autres upserts en masse
// de ce projet sans clé composée dédiée (`bulkSetAttendance`, l'ancien
// `bulkSetGrades`).
export async function bulkSetGradeEvaluation(
  schoolId: string,
  input: BulkGradeEvaluationInput,
  scope: TeacherScope | null = null
) {
  const subject = await assertSubjectInSchool(schoolId, input.subjectId);
  await assertGroupeInSchool(schoolId, input.groupeId);
  if (scope) assertGroupeSubjectInScope(scope, input.groupeId, input.subjectId);
  for (const entry of input.entries) {
    await assertStudentInSchool(schoolId, entry.studentId);
  }

  // Correctif audit (N+1) — la version précédente faisait, PAR ÉLÈVE, un
  // findFirst de Grade + un findFirst de GradeEvaluation + un éventuel
  // count, soit ~3 allers-retours DB par ligne à l'intérieur d'une même
  // transaction (verrouillage prolongé pour rien sur un gros effectif).
  // Ci-dessous : tout ce qui peut être préchargé en masse l'est en UNE
  // requête chacun (Grade, GradeEvaluation existantes, comptage par grade),
  // puis la boucle sur `input.entries` ne fait plus que de la lecture en
  // mémoire (Map) avant TROIS écritures groupées (delete/create en masse,
  // update — nécessairement un par ligne puisque chaque ligne a sa propre
  // valeur, ce qui n'est pas le N+1 visé ici).
  const result = await prisma.$transaction(async (tx) => {
    const studentIds = input.entries.map((e) => e.studentId);

    // 1. Grade shells : un seul findMany pour ceux qui existent déjà : la
    // seule chose qui varie par entrée est studentId (subjectId/trimestre
    // sont constants pour tout l'appel), donc un filtre `in` suffit.
    const existingGrades = await tx.grade.findMany({
      where: { studentId: { in: studentIds }, subjectId: input.subjectId, trimestre: input.trimestre },
    });
    const gradeByStudent = new Map(existingGrades.map((g) => [g.studentId, g]));

    // Prisma `createMany` ne renvoie pas les lignes créées (donc pas leur
    // id) — pour les Grade manquants, on garde une petite boucle de
    // création (dédupliquée : `entries` pourrait en théorie répéter un
    // studentId), ce qui reste O(nombre d'élèves SANS grade déjà créé), pas
    // O(n) sur tout l'effectif comme avant.
    const missingStudentIds = Array.from(new Set(studentIds.filter((id) => !gradeByStudent.has(id))));
    for (const studentId of missingStudentIds) {
      const grade = await tx.grade.create({
        data: { studentId, subjectId: input.subjectId, trimestre: input.trimestre },
      });
      gradeByStudent.set(studentId, grade);
    }

    const gradeIds = Array.from(gradeByStudent.values()).map((g) => g.id);

    // 2. Évaluations existantes pour ce libellé, sur TOUS les grades
    // concernés, en une seule requête (label constant pour tout l'appel).
    const existingEvaluations = gradeIds.length
      ? await tx.gradeEvaluation.findMany({ where: { gradeId: { in: gradeIds }, label: input.label } })
      : [];

    // 3. Position ("order") courante de chaque grade = nombre
    // d'évaluations (TOUS libellés confondus) déjà présentes — préchargé en
    // une seule requête plutôt qu'un `count` par ligne. Pas de filtre sur
    // `label` ici : `order` reflète la position parmi TOUTES les
    // évaluations du bulletin, pas seulement celles de ce libellé (comme
    // dans la version d'origine).
    const evaluationCountRows = gradeIds.length
      ? await tx.gradeEvaluation.findMany({ where: { gradeId: { in: gradeIds } }, select: { gradeId: true } })
      : [];
    const countByGradeId = new Map<string, number>();
    for (const row of evaluationCountRows) {
      countByGradeId.set(row.gradeId, (countByGradeId.get(row.gradeId) ?? 0) + 1);
    }

    // État en mémoire de l'évaluation "{gradeId, label}" pour la durée de
    // cette boucle — permet de rester correct même si `entries` répétait un
    // studentId (comme la version séquentielle d'origine, où la 2e passe
    // relisait l'état laissé par la 1re), sans plus jamais interroger la DB.
    type PendingCreate = { gradeId: string; label: string; value: number; weight: number; order: number };
    type EvalState =
      | { kind: "none" }
      | { kind: "db"; id: string }
      | { kind: "new"; ref: PendingCreate };
    const stateByGradeId = new Map<string, EvalState>();
    for (const evaluation of existingEvaluations) {
      stateByGradeId.set(evaluation.gradeId, { kind: "db", id: evaluation.id });
    }

    const idsToDelete: string[] = [];
    const toCreate: PendingCreate[] = [];
    const toUpdate = new Map<string, { value: number; weight: number }>();
    let updated = 0;
    // Itération 110 — élèves dont une VALEUR réelle vient d'être enregistrée
    // (créée ou corrigée) dans cette boucle, jamais ceux du cas "case laissée
    // vide" ci-dessous (`continue` avant d'atteindre ce point) — voir le
    // commentaire de `notifyGradeGuardians` plus haut pour le périmètre exact
    // du push. Alimenté au même point que `updated` (juste avant `updated +=
    // 1`, la marque déjà existante de "ceci est une vraie écriture").
    const notifiableStudentIds: string[] = [];

    for (const entry of input.entries) {
      const grade = gradeByStudent.get(entry.studentId)!;
      const state = stateByGradeId.get(grade.id) ?? { kind: "none" as const };

      if (entry.value === null) {
        // Case laissée vide : on retire l'évaluation si elle existait déjà
        // (en DB ou tout juste marquée pour création dans cette même
        // boucle), sinon rien à faire — comme l'original, ce cas n'incrémente
        // PAS `updated` (le `continue` d'origine sautait ce compteur).
        if (state.kind === "db") {
          idsToDelete.push(state.id);
          toUpdate.delete(state.id);
        } else if (state.kind === "new") {
          const idx = toCreate.indexOf(state.ref);
          if (idx !== -1) toCreate.splice(idx, 1);
        }
        stateByGradeId.set(grade.id, { kind: "none" });
        continue;
      }

      if (state.kind === "db") {
        toUpdate.set(state.id, { value: entry.value, weight: input.weight });
      } else if (state.kind === "new") {
        state.ref.value = entry.value;
        state.ref.weight = input.weight;
      } else {
        const order = countByGradeId.get(grade.id) ?? 0;
        countByGradeId.set(grade.id, order + 1);
        const pending: PendingCreate = {
          gradeId: grade.id,
          label: input.label,
          value: entry.value,
          weight: input.weight,
          order,
        };
        toCreate.push(pending);
        stateByGradeId.set(grade.id, { kind: "new", ref: pending });
      }
      notifiableStudentIds.push(entry.studentId);
      updated += 1;
    }

    if (idsToDelete.length) {
      await tx.gradeEvaluation.deleteMany({ where: { id: { in: idsToDelete } } });
    }
    if (toCreate.length) {
      await tx.gradeEvaluation.createMany({ data: toCreate });
    }
    if (toUpdate.size) {
      await Promise.all(
        Array.from(toUpdate.entries()).map(([id, data]) => tx.gradeEvaluation.update({ where: { id }, data }))
      );
    }

    return { updated, notifiableStudentIds };
  });

  // Hors transaction, jamais attendue (voir le commentaire de
  // `notifyGradeGuardians` plus haut) : la réponse REST part dès que la
  // transaction ci-dessus est validée, sans attendre l'envoi des push.
  void notifyGradeGuardians(schoolId, result.notifiableStudentIds, subject.name, input.label);

  return { updated: result.updated };
}

// Retire une évaluation (par libellé) de tous les élèves d'une classe pour
// une matière/trimestre donné — pour annuler une évaluation créée par
// erreur sans repasser élève par élève.
export async function deleteEvaluationForClass(
  schoolId: string,
  input: DeleteEvaluationInput,
  scope: TeacherScope | null = null
) {
  await assertSubjectInSchool(schoolId, input.subjectId);
  await assertGroupeInSchool(schoolId, input.groupeId);
  if (scope) assertGroupeSubjectInScope(scope, input.groupeId, input.subjectId);

  const students = await prisma.student.findMany({
    where: { schoolId, groupeId: input.groupeId },
    select: { id: true },
  });
  const grades = await prisma.grade.findMany({
    where: { subjectId: input.subjectId, trimestre: input.trimestre, studentId: { in: students.map((s) => s.id) } },
    select: { id: true },
  });
  await prisma.gradeEvaluation.deleteMany({
    where: { gradeId: { in: grades.map((g) => g.id) }, label: input.label },
  });
}

// Moyennes pondérées de tous les élèves d'une classe pour un trimestre —
// base commune du bulletin individuel et du classement de classe. Un élève
// sans aucune note saisie dans une matière donnée obtient une moyenne
// générale `null` s'il n'a AUCUNE note du tout (pas encore évalué), sinon la
// moyenne ne porte que sur les matières effectivement notées (une matière
// sans note n'est comptée ni au numérateur ni au dénominateur) — choix
// documenté : pénaliser à 0 une matière pas encore notée aurait faussé la
// moyenne d'un bulletin en cours de remplissage.
// Exportée (itération 43) pour être réutilisée par le module `end-of-year`
// (moyenne annuelle = moyenne des moyennes de trimestre) sans dupliquer ce
// calcul — même principe que `computeAverage`, déjà exporté pour `analytics`.
export async function computeClassAverages(schoolId: string, groupeId: string, trimestre: number) {
  await assertGroupeInSchool(schoolId, groupeId);

  const [coefficients, students] = await Promise.all([
    prisma.subjectCoefficient.findMany({
      where: { groupeId },
      include: { subject: subjectSelect },
    }),
    prisma.student.findMany({ where: { schoolId, groupeId }, orderBy: { fullName: "asc" } }),
  ]);

  const subjectIds = coefficients.map((c) => c.subjectId);
  const grades = subjectIds.length
    ? await prisma.grade.findMany({
        where: { trimestre, subjectId: { in: subjectIds }, studentId: { in: students.map((s) => s.id) } },
        include: { evaluations: evaluationsOrder },
      })
    : [];

  const rows = students.map((student) => {
    let totalWeighted = 0;
    let totalCoefficient = 0;
    const subjects = coefficients.map((coef) => {
      const grade = grades.find((g) => g.studentId === student.id && g.subjectId === coef.subjectId);
      const average = grade ? computeAverage(grade.evaluations) : null;
      if (average !== null) {
        totalWeighted += average * Number(coef.coefficient);
        totalCoefficient += Number(coef.coefficient);
      }
      return {
        subjectId: coef.subjectId,
        subjectName: coef.subject.name,
        coefficient: coef.coefficient,
        evaluations: grade?.evaluations ?? [],
        average,
      };
    });

    return {
      student: { id: student.id, matricule: student.matricule, fullName: student.fullName },
      subjects,
      average: totalCoefficient > 0 ? totalWeighted / totalCoefficient : null,
    };
  });

  // Tri décroissant par moyenne, les élèves sans moyenne (pas encore
  // évalués) en fin de classement plutôt qu'en tête.
  rows.sort((a, b) => {
    if (a.average === null && b.average === null) return a.student.fullName.localeCompare(b.student.fullName);
    if (a.average === null) return 1;
    if (b.average === null) return -1;
    return b.average - a.average;
  });

  return rows.map((row, index) => ({ ...row, rank: row.average !== null ? index + 1 : null }));
}

export async function getClassRanking(
  schoolId: string,
  groupeId: string,
  trimestre: number,
  scope: TeacherScope | null = null
) {
  // Accès complet au classement de ses classes (toutes matières) — choix
  // explicite de l'utilisateur pour l'itération 29 : un enseignant voit le
  // classement comme il le ferait en conseil de classe. Seule la saisie/le
  // détail par matière reste restreint (voir getGrade/bulkSetGradeEvaluation).
  if (scope) assertGroupeInScope(scope, groupeId);
  const rows = await computeClassAverages(schoolId, groupeId, trimestre);
  return rows.map(({ student, average, rank }) => ({ student, average, rank }));
}

export async function getStudentBulletin(
  schoolId: string,
  studentId: string,
  trimestre: number,
  scope: TeacherScope | null = null
) {
  const student = await assertStudentInSchool(schoolId, studentId);
  if (!student.groupeId) throw ApiError.badRequest("Cet élève n'est affecté à aucune classe.");
  // Même principe : accès complet au bulletin (toutes matières) pour un
  // élève de l'une de ses classes.
  if (scope) assertGroupeInScope(scope, student.groupeId);

  const params = await prisma.schoolParameters.findUnique({ where: { schoolId } });
  if (!params) throw ApiError.notFound("Paramètres introuvables pour cette école.");

  const rows = await computeClassAverages(schoolId, student.groupeId, trimestre);
  const own = rows.find((r) => r.student.id === studentId);
  if (!own) throw ApiError.notFound("Aucune donnée de classe pour cet élève.");

  return {
    student: own.student,
    trimestre,
    subjects: own.subjects,
    average: own.average,
    rank: own.rank,
    classSize: rows.length,
    mention: computeMention(own.average, params),
    noteMax: params.noteMax,
    notePassage: params.notePassage,
  };
}
