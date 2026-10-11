import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import type {
  ClasseInput,
  CycleInput,
  FeeLevelInput,
  GroupeInput,
  PedagogicalInput,
  SalleInput,
  SchoolYearInput,
  SerieInput,
} from "./parameters.schema";

// Itération 35 — helpers de garde communs à toutes les entités de la
// structure pédagogique : vérifier qu'un id référencé appartient bien à
// cette école (Cycle/Salle) ou à ce parent précis (Classe -> Cycle, Serie ->
// Classe, Groupe -> Classe/Serie), même patron que `assertGroupeInSchool`
// dans les autres modules.
async function assertCycleInSchool(schoolId: string, cycleId: string) {
  const cycle = await prisma.cycle.findFirst({ where: { id: cycleId, schoolId } });
  if (!cycle) throw ApiError.notFound("Cycle introuvable dans cette école.");
  return cycle;
}

async function assertClasseInSchool(schoolId: string, classeId: string) {
  const classe = await prisma.classe.findFirst({ where: { id: classeId, schoolId } });
  if (!classe) throw ApiError.notFound("Classe introuvable dans cette école.");
  return classe;
}

async function assertSerieInClasse(schoolId: string, classeId: string, serieId: string) {
  const serie = await prisma.serie.findFirst({ where: { id: serieId, schoolId, classeId } });
  if (!serie) throw ApiError.notFound("Série introuvable pour cette classe.");
  return serie;
}

export async function getParameters(schoolId: string) {
  const params = await prisma.schoolParameters.findUnique({ where: { schoolId } });
  if (!params) throw ApiError.notFound("Paramètres introuvables pour cette école.");

  // Itération 44 — `school` inclus pour exposer `currentSchoolYearId` (l'id
  // de l'année scolaire "courante" de l'école, voir schema.prisma) sans
  // endpoint séparé : StructurePage/EndOfYearPage/etc. en ont toutes besoin
  // pour pré-sélectionner un combo, exactement comme elles utilisent déjà
  // `cycles`/`classes`/... ci-dessous pour les leurs.
  const [feeLevels, cycles, classes, series, groupes, salles, schoolYears, school] = await Promise.all([
    prisma.feeLevel.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
    prisma.cycle.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
    prisma.classe.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
    prisma.serie.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
    prisma.groupe.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.salle.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.schoolYear.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { currentSchoolYearId: true } }),
  ]);

  return {
    ...params,
    feeLevels,
    cycles,
    classes,
    series,
    groupes,
    salles,
    schoolYears,
    currentSchoolYearId: school?.currentSchoolYearId ?? null,
  };
}

export async function updateParameters(schoolId: string, input: PedagogicalInput) {
  return prisma.schoolParameters.update({ where: { schoolId }, data: input });
}

// Itération 35 — upsert désormais sur `classeId` (vraie FK, `@unique` mono-
// colonne) plutôt que sur `(schoolId, levelName)` texte libre.
export async function upsertFeeLevels(schoolId: string, levels: FeeLevelInput[]) {
  for (const level of levels) {
    await assertClasseInSchool(schoolId, level.classeId);
  }
  return prisma.$transaction(
    levels.map((level, index) =>
      prisma.feeLevel.upsert({
        where: { classeId: level.classeId },
        update: { amount: level.amount, monthlyAmount: level.monthlyAmount, order: level.order ?? index },
        create: {
          schoolId,
          classeId: level.classeId,
          amount: level.amount,
          monthlyAmount: level.monthlyAmount,
          order: level.order ?? index,
        },
      })
    )
  );
}

export async function deleteFeeLevel(schoolId: string, feeLevelId: string) {
  await prisma.feeLevel.deleteMany({ where: { id: feeLevelId, schoolId } });
}

// ----------------------------------------------------------------------------
// CYCLE (Primaire / Collège / Lycée)
// ----------------------------------------------------------------------------

export async function upsertCycle(schoolId: string, data: CycleInput) {
  const existing = await prisma.cycle.findFirst({
    where: { schoolId, name: data.name, id: data.id ? { not: data.id } : undefined },
  });
  if (existing) throw ApiError.conflict("Un cycle porte déjà ce nom dans cette école.");

  if (data.id) {
    await assertCycleInSchool(schoolId, data.id);
    return prisma.cycle.update({ where: { id: data.id }, data: { name: data.name, order: data.order } });
  }
  return prisma.cycle.create({ data: { schoolId, name: data.name, order: data.order ?? 0 } });
}

export async function deleteCycle(schoolId: string, cycleId: string) {
  // Cascade en base jusqu'aux Classes/Séries/Groupes/FeeLevel de ce cycle
  // (voir schema.prisma) — même choix que la suppression d'un Groupe
  // ailleurs dans ce module : aucune vérification bloquante côté service, la
  // cascade documente déjà l'effet attendu.
  await prisma.cycle.deleteMany({ where: { id: cycleId, schoolId } });
}

// ----------------------------------------------------------------------------
// CLASSE (niveau, ex "6ème", "Seconde")
// ----------------------------------------------------------------------------

export async function upsertClasse(schoolId: string, data: ClasseInput) {
  await assertCycleInSchool(schoolId, data.cycleId);
  const existing = await prisma.classe.findFirst({
    where: { schoolId, name: data.name, id: data.id ? { not: data.id } : undefined },
  });
  if (existing) throw ApiError.conflict("Une classe porte déjà ce nom dans cette école.");

  if (data.id) {
    await assertClasseInSchool(schoolId, data.id);
    return prisma.classe.update({
      where: { id: data.id },
      data: { cycleId: data.cycleId, name: data.name, order: data.order },
    });
  }
  return prisma.classe.create({
    data: { schoolId, cycleId: data.cycleId, name: data.name, order: data.order ?? 0 },
  });
}

export async function deleteClasse(schoolId: string, classeId: string) {
  await prisma.classe.deleteMany({ where: { id: classeId, schoolId } });
}

// ----------------------------------------------------------------------------
// SERIE (ex "L", "G", "S" au sein d'une Classe)
// ----------------------------------------------------------------------------

export async function upsertSerie(schoolId: string, data: SerieInput) {
  await assertClasseInSchool(schoolId, data.classeId);
  const existing = await prisma.serie.findFirst({
    where: { classeId: data.classeId, name: data.name, id: data.id ? { not: data.id } : undefined },
  });
  if (existing) throw ApiError.conflict("Une série porte déjà ce nom pour cette classe.");

  if (data.id) {
    await assertSerieInClasse(schoolId, data.classeId, data.id);
    return prisma.serie.update({
      where: { id: data.id },
      data: { classeId: data.classeId, name: data.name, order: data.order },
    });
  }
  return prisma.serie.create({
    data: { schoolId, classeId: data.classeId, name: data.name, order: data.order ?? 0 },
  });
}

export async function deleteSerie(schoolId: string, serieId: string) {
  await prisma.serie.deleteMany({ where: { id: serieId, schoolId } });
}

// ----------------------------------------------------------------------------
// GROUPE (section concrète affectée aux élèves, ex "4ème A")
// ----------------------------------------------------------------------------

// Correctif itération 35 — voir le commentaire de `Groupe` dans
// schema.prisma : pas de contrainte d'unicité en base sur
// (classeId, serieId, name) à cause du traitement de NULL par Postgres,
// donc vérifié ici, exactement comme pour `Enrollment`/`GradeEvaluation`.
async function assertGroupeNameAvailable(
  schoolId: string,
  classeId: string,
  serieId: string | null | undefined,
  name: string,
  excludeId?: string
) {
  const existing = await prisma.groupe.findFirst({
    where: {
      schoolId,
      classeId,
      serieId: serieId ?? null,
      name,
      id: excludeId ? { not: excludeId } : undefined,
    },
  });
  if (existing) throw ApiError.conflict(`Un groupe "${name}" existe déjà pour cette classe/série.`);
}

export async function upsertGroupe(schoolId: string, data: GroupeInput) {
  await assertClasseInSchool(schoolId, data.classeId);
  if (data.serieId) await assertSerieInClasse(schoolId, data.classeId, data.serieId);

  if (data.id) {
    await assertGroupeNameAvailable(schoolId, data.classeId, data.serieId, data.name, data.id);
    return prisma.groupe.update({
      where: { id: data.id },
      data: {
        name: data.name,
        classeId: data.classeId,
        serieId: data.serieId ?? null,
        targetSize: data.targetSize,
      },
    });
  }
  await assertGroupeNameAvailable(schoolId, data.classeId, data.serieId, data.name);
  return prisma.groupe.create({
    data: {
      schoolId,
      name: data.name,
      classeId: data.classeId,
      serieId: data.serieId ?? null,
      targetSize: data.targetSize,
    },
  });
}

export async function deleteGroupe(schoolId: string, groupeId: string) {
  await prisma.groupe.deleteMany({ where: { id: groupeId, schoolId } });
}

// ----------------------------------------------------------------------------
// SALLE (local physique — indépendant de la hiérarchie Cycle/Classe/Série/Groupe)
// ----------------------------------------------------------------------------

export async function upsertSalle(schoolId: string, data: SalleInput) {
  const existing = await prisma.salle.findFirst({
    where: { schoolId, name: data.name, id: data.id ? { not: data.id } : undefined },
  });
  if (existing) throw ApiError.conflict("Une salle porte déjà ce nom dans cette école.");

  if (data.id) {
    return prisma.salle.update({
      where: { id: data.id },
      data: { name: data.name, capacity: data.capacity, type: data.type },
    });
  }
  return prisma.salle.create({
    data: { schoolId, name: data.name, capacity: data.capacity, type: data.type },
  });
}

export async function deleteSalle(schoolId: string, salleId: string) {
  await prisma.salle.deleteMany({ where: { id: salleId, schoolId } });
}

// ----------------------------------------------------------------------------
// ANNÉES SCOLAIRES (itération 44 — voir schema.prisma::SchoolYear pour le
// cadrage complet). Même patron upsert(id?) que les cinq entités ci-dessus.
// ----------------------------------------------------------------------------

async function assertSchoolYearInSchool(schoolId: string, schoolYearId: string) {
  const year = await prisma.schoolYear.findFirst({ where: { id: schoolYearId, schoolId } });
  if (!year) throw ApiError.notFound("Année scolaire introuvable dans cette école.");
  return year;
}

export async function upsertSchoolYear(schoolId: string, data: SchoolYearInput) {
  const existing = await prisma.schoolYear.findFirst({
    where: { schoolId, label: data.label, id: data.id ? { not: data.id } : undefined },
  });
  if (existing) throw ApiError.conflict("Une année scolaire porte déjà ce libellé dans cette école.");

  if (data.id) {
    await assertSchoolYearInSchool(schoolId, data.id);
    return prisma.schoolYear.update({ where: { id: data.id }, data: { label: data.label, order: data.order } });
  }
  return prisma.schoolYear.create({
    data: { schoolId, label: data.label, order: data.order ?? 0 },
  });
}

// Suppression protégée (`onDelete: Restrict` en base, voir schema.prisma) :
// vérifiée ici D'ABORD pour renvoyer un message clair plutôt que de laisser
// remonter une violation de contrainte SQL brute au frontend — même esprit
// que le contrôle anti-doublon d'`enrollments.service.ts::createEnrollment`.
export async function deleteSchoolYear(schoolId: string, schoolYearId: string) {
  await assertSchoolYearInSchool(schoolId, schoolYearId);
  const [enrollments, tuitionFees, decisions, decisionsAsEnrollYear] = await Promise.all([
    prisma.enrollment.count({ where: { schoolYearId } }),
    prisma.tuitionFee.count({ where: { schoolYearId } }),
    prisma.endOfYearDecision.count({ where: { schoolYearId } }),
    prisma.endOfYearDecision.count({ where: { enrollmentSchoolYearId: schoolYearId } }),
  ]);
  if (enrollments || tuitionFees || decisions || decisionsAsEnrollYear) {
    throw ApiError.conflict(
      "Cette année scolaire est utilisée par des inscriptions, de l'écolage ou des décisions de fin d'année : elle ne peut pas être supprimée."
    );
  }
  await prisma.schoolYear.deleteMany({ where: { id: schoolYearId, schoolId } });
}

// Définit l'année scolaire "courante" de l'école (`School.currentSchoolYearId`,
// voir schema.prisma) — sert de valeur par défaut aux filtres "Année
// scolaire" du frontend (même rôle que l'ancien champ texte `School.
// schoolYear`), jamais de contrainte métier au-delà de ça.
export async function setCurrentSchoolYear(schoolId: string, schoolYearId: string | null) {
  if (schoolYearId) await assertSchoolYearInSchool(schoolId, schoolYearId);
  return prisma.school.update({ where: { id: schoolId }, data: { currentSchoolYearId: schoolYearId } });
}
