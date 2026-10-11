import type { PrismaClient } from "../../src/generated/prisma/client";
import { computeStatus } from "../../src/modules/enrollments/enrollments.service";
import type { SeededSchool } from "./school.seed";
import type { SeededStudent } from "./students.seed";
import type { FeeLevelAmounts } from "./parameters.seed";
import { seedId } from "./ids";

// Itération 34 — écolage mensuel, distinct du droit d'inscription annuel
// (`enrollments.seed.ts`). `TuitionFee` a une VRAIE contrainte d'unicité en
// base (`@@unique([studentId, schoolYearId, month])`, contrairement à
// `Enrollment` — voir schema.prisma) : upsert direct dessus, même patron que
// tout autre modèle contraint de ce projet (`FeeLevel`, `Groupe`, ...).
//
// Mois générés : 4 mois de démo (septembre à décembre, cohérent avec
// `trimestreEnCours: 2` déjà seedé par `parameters.seed.ts` — l'année
// scolaire est en cours, pas encore terminée) plutôt que les 12 mois d'une
// année complète, pour représenter un état réaliste "on n'a pas encore
// tout généré/tout encaissé" plutôt qu'une année déjà bouclée.
const DEMO_MONTHS = [9, 10, 11, 12];

// Répartition volontaire sur les 6 élèves de démo, mois par mois, pour que
// le rapport "Suivi des paiements" (nouveau cette itération) montre bien
// les 2 cas dès le premier chargement : un élève à jour sur tous les mois
// générés, et un élève en retard sur au moins un mois récent. Indexée comme
// `PAYMENT_RATIOS` de `enrollments.seed.ts`, mais DÉCROISSANTE avec le mois
// (plus on avance dans l'année, plus le retard se creuse pour les élèves
// déjà partiels/impayés sur le droit d'inscription).
const MONTHLY_PAYMENT_RATIOS: number[][] = [
  [1, 1, 1, 1], // à jour toute l'année
  [1, 1, 1, 1], // à jour toute l'année
  [1, 1, 0.5, 0], // règle avec du retard qui s'installe
  [1, 0.6, 0, 0], // idem, plus marqué
  [1, 0, 0, 0], // ne règle plus depuis octobre
  [0, 0, 0, 0], // n'a rien réglé cette année
];
const PAYMENT_MODES = ["Espèces", "Mobile Money", "Virement bancaire"];

export async function seedTuitionFees(
  prisma: PrismaClient,
  school: SeededSchool,
  feeLevelAmounts: Map<string, FeeLevelAmounts>,
  students: Map<string, SeededStudent>
) {
  // Itération 44 — voir le commentaire équivalent dans enrollments.seed.ts.
  const { schoolYearId, schoolYearLabel } = school;
  const studentList = [...students.values()];

  for (const [index, student] of studentList.entries()) {
    const monthlyRate = feeLevelAmounts.get(student.classeName)?.monthlyAmount ?? 10000;
    const ratios = MONTHLY_PAYMENT_RATIOS[index % MONTHLY_PAYMENT_RATIOS.length];

    for (const [monthIndex, month] of DEMO_MONTHS.entries()) {
      const amountDue = monthlyRate;
      const ratio = ratios[monthIndex % ratios.length];
      const amountPaid = Math.round(amountDue * ratio);
      const id = seedId(`tuition:${student.matricule}:${schoolYearLabel}:${month}`);

      await prisma.tuitionFee.upsert({
        where: { id },
        update: {
          amountDue,
          amountPaid,
          paymentMode: amountPaid > 0 ? PAYMENT_MODES[index % PAYMENT_MODES.length] : null,
          paymentDate: amountPaid > 0 ? new Date(2024, month - 1, 5) : null,
          status: computeStatus(amountDue, amountPaid),
        },
        create: {
          id,
          studentId: student.id,
          schoolYearId,
          month,
          amountDue,
          amountPaid,
          paymentMode: amountPaid > 0 ? PAYMENT_MODES[index % PAYMENT_MODES.length] : null,
          paymentDate: amountPaid > 0 ? new Date(2024, month - 1, 5) : null,
          status: computeStatus(amountDue, amountPaid),
        },
      });
    }
  }
}
