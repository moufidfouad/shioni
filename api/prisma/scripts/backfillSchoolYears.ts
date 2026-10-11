// ----------------------------------------------------------------------------
// RÉTRO-MIGRATION — Années scolaires (itération 44)
// ----------------------------------------------------------------------------
//
// Ce script n'a jamais pu être EXÉCUTÉ dans ce bac à sable : `prisma migrate`
// (comme `prisma generate`) est bloqué par le pare-feu réseau depuis
// l'itération 12 (voir README.md / doc d'architecture, "Notes de sécurité" et
// "Points établis à respecter"). Il est fourni entièrement écrit et commenté
// pour une VRAIE mise en production sur une base déjà peuplée AVANT
// l'itération 44 — c'est-à-dire une base où `School.schoolYear`,
// `Enrollment.schoolYear`, `TuitionFee.schoolYear` et
// `EndOfYearDecision.schoolYear` existent encore comme colonnes texte libre
// (voir schema.prisma d'avant cette itération), puisque cette itération les a
// remplacées par des clés étrangères vers un nouveau modèle `SchoolYear`.
//
// Une base FRAÎCHE (créée via `prisma migrate dev` puis `prisma/seed.ts` à
// partir du schéma de CETTE itération) n'a pas ce problème : les seeds créent
// directement des lignes `SchoolYear` et les référencent (voir
// `seeds/school.seed.ts`) — ce script ne la concerne pas.
//
// PROCÉDURE DE DÉPLOIEMENT EN 3 ÉTAPES (aucune ne peut être sautée) :
//
//   1. Migration Prisma n°1 — AJOUTE uniquement les nouvelles colonnes/tables
//      sans toucher aux anciennes : `CREATE TABLE school_years`, puis
//      `ALTER TABLE enrollments ADD COLUMN "schoolYearId" TEXT NULL`
//      (NULLABLE à ce stade, pas encore la FK ni la contrainte NOT NULL —
//      idem pour `tuition_fees`/`end_of_year_decisions`/`schools.
//      currentSchoolYearId`). Générée avec `prisma migrate dev --create-only`
//      à partir d'un schema.prisma INTERMÉDIAIRE qui garde encore les
//      anciennes colonnes texte le temps de cette étape.
//
//   2. CE SCRIPT — backfill des données, une fois la migration n°1 appliquée
//      en production : `npx ts-node prisma/scripts/backfillSchoolYears.ts`
//      (ou compilé, selon l'environnement réel de déploiement — absent de ce
//      bac à sable).
//
//   3. Migration Prisma n°2 — une fois le backfill vérifié (toutes les
//      lignes ont bien un `schoolYearId` non NULL) : applique le schema.
//      prisma FINAL de cette itération (celui réellement livré) — rend
//      `schoolYearId` obligatoire, ajoute la vraie FK/contrainte
//      `onDelete: Restrict`, et SUPPRIME les anciennes colonnes texte
//      (`schoolYear` sur les 4 tables concernées).
//
// Ce script utilise du SQL BRUT (`$queryRawUnsafe`/`$executeRawUnsafe`)
// plutôt que le client Prisma généré : après la migration n°1, le client
// généré à partir du schema.prisma FINAL ne connaît déjà plus les anciennes
// colonnes texte qu'il doit pourtant encore lire ici.
// ----------------------------------------------------------------------------

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { env } from "../../src/config/env";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface OldSchoolRow {
  id: string;
  schoolYear: string | null;
}

async function main() {
  const schools = await prisma.$queryRawUnsafe<OldSchoolRow[]>(
    `SELECT id, "schoolYear" FROM schools`
  );

  for (const school of schools) {
    // Toutes les valeurs de schoolYear texte encore référencées par CETTE
    // école, tous horizons confondus : l'année "courante" de l'école, plus
    // toutes celles utilisées par ses inscriptions/écolages/décisions —
    // aucune ne doit être perdue, même une année qui n'est plus "courante".
    const [enrollmentYears, tuitionYears, decisionYears] = await Promise.all([
      prisma.$queryRawUnsafe<{ schoolYear: string }[]>(
        `SELECT DISTINCT e."schoolYear" FROM enrollments e
         JOIN students s ON s.id = e."studentId"
         WHERE s."schoolId" = $1 AND e."schoolYear" IS NOT NULL`,
        school.id
      ),
      prisma.$queryRawUnsafe<{ schoolYear: string }[]>(
        `SELECT DISTINCT t."schoolYear" FROM tuition_fees t
         JOIN students s ON s.id = t."studentId"
         WHERE s."schoolId" = $1 AND t."schoolYear" IS NOT NULL`,
        school.id
      ),
      prisma.$queryRawUnsafe<{ schoolYear: string }[]>(
        `SELECT DISTINCT d."schoolYear" FROM end_of_year_decisions d
         JOIN students s ON s.id = d."studentId"
         WHERE s."schoolId" = $1 AND d."schoolYear" IS NOT NULL`,
        school.id
      ),
    ]);

    const labels = new Set<string>([
      ...(school.schoolYear ? [school.schoolYear] : []),
      ...enrollmentYears.map((r) => r.schoolYear),
      ...tuitionYears.map((r) => r.schoolYear),
      ...decisionYears.map((r) => r.schoolYear),
    ]);

    if (labels.size === 0) continue;

    // Ordre = ordre alphabétique des libellés triés — une hypothèse
    // raisonnable pour un libellé au format "AAAA-AAAA" cohérent (le cas de
    // ce projet), mais SEULEMENT un point de départ : l'ordre réel reste
    // librement corrigeable après coup depuis l'onglet "Années scolaires" de
    // la page Structure pédagogique (`SchoolYear.order`, jamais recalculé
    // automatiquement une fois cette rétro-migration terminée).
    const sortedLabels = [...labels].sort();
    const idByLabel = new Map<string, string>();

    for (const [index, label] of sortedLabels.entries()) {
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO school_years (id, "schoolId", label, "order", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, now(), now())
         ON CONFLICT ("schoolId", label) DO UPDATE SET label = EXCLUDED.label
         RETURNING id`,
        school.id,
        label,
        index
      );
      idByLabel.set(label, rows[0].id);
    }

    for (const label of sortedLabels) {
      const schoolYearId = idByLabel.get(label)!;
      await prisma.$executeRawUnsafe(
        `UPDATE enrollments e SET "schoolYearId" = $1
         FROM students s
         WHERE s.id = e."studentId" AND s."schoolId" = $2 AND e."schoolYear" = $3`,
        schoolYearId,
        school.id,
        label
      );
      await prisma.$executeRawUnsafe(
        `UPDATE tuition_fees t SET "schoolYearId" = $1
         FROM students s
         WHERE s.id = t."studentId" AND s."schoolId" = $2 AND t."schoolYear" = $3`,
        schoolYearId,
        school.id,
        label
      );
      await prisma.$executeRawUnsafe(
        `UPDATE end_of_year_decisions d SET "schoolYearId" = $1
         FROM students s
         WHERE s.id = d."studentId" AND s."schoolId" = $2 AND d."schoolYear" = $3`,
        schoolYearId,
        school.id,
        label
      );
    }

    if (school.schoolYear && idByLabel.has(school.schoolYear)) {
      await prisma.$executeRawUnsafe(
        `UPDATE schools SET "currentSchoolYearId" = $1 WHERE id = $2`,
        idByLabel.get(school.schoolYear),
        school.id
      );
    }

    console.log(
      `✅ École ${school.id} : ${sortedLabels.length} année(s) scolaire(s) créée(s)/liée(s) (${sortedLabels.join(", ")}).`
    );
  }

  console.log("");
  console.log("Backfill terminé. Vérifier qu'AUCUNE ligne ne reste avec schoolYearId NULL avant");
  console.log("d'appliquer la migration Prisma n°2 (voir l'en-tête de ce fichier), par exemple :");
  console.log(`  SELECT count(*) FROM enrollments WHERE "schoolYearId" IS NULL;`);
  console.log(`  SELECT count(*) FROM tuition_fees WHERE "schoolYearId" IS NULL;`);
  console.log(`  SELECT count(*) FROM end_of_year_decisions WHERE "schoolYearId" IS NULL;`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
