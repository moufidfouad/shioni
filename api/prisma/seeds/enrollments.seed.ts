import type { PrismaClient } from "../../src/generated/prisma/client";
import { computeStatus } from "../../src/modules/enrollments/enrollments.service";
import type { SeededSchool } from "./school.seed";
import type { SeededStudent } from "./students.seed";
import type { FeeLevelAmounts } from "./parameters.seed";
import { seedId } from "./ids";

// `Enrollment` n'a pas de contrainte d'unicité en base (l'unicité "un élève,
// une inscription par année scolaire" est vérifiée côté service — voir
// `enrollments.service.ts`) : upsert sur un id dérivé de
// `matricule + année scolaire`. Le statut n'est jamais choisi à la main ici
// non plus : `computeStatus` (la même fonction que le service applicatif,
// exportée pour l'occasion) le déduit des montants, pour que le seed ne
// puisse jamais produire une donnée que l'application elle-même ne
// produirait pas.
//
// Répartition volontaire sur les 6 élèves de démo : 2 soldés, 2 partiels,
// 2 impayés — pour que les 3 statuts soient visibles dès le premier
// chargement de la page Inscriptions & frais.
const PAYMENT_RATIOS = [1, 1, 0.5, 0.4, 0, 0];
const PAYMENT_MODES = ["Espèces", "Mobile Money", "Virement bancaire"];

// Un seul élève de démo illustre une réduction négociée (itération 25) —
// juste assez pour que la colonne "Réduction" et la carte de stats associée
// ne soient pas vides au premier chargement, sans fausser la répartition
// soldé/partiel/impayé ci-dessus (le statut se recalcule toujours sur le
// `feeDue` déjà réduit, jamais sur le barème standard).
const DISCOUNTED_STUDENT_INDEX = 4; // YOUSSOUF Chamsudine (4ème A)
const DISCOUNT_RATIO = 0.2; // 20 % — exemple "enfant du personnel"
const DISCOUNT_REASON = "Enfant du personnel — réduction accordée par le directeur";

export async function seedEnrollments(
  prisma: PrismaClient,
  school: SeededSchool,
  feeLevelAmounts: Map<string, FeeLevelAmounts>,
  students: Map<string, SeededStudent>
) {
  // Itération 44 — `schoolYearId` (FK réelle) remplace l'ancien `schoolYear`
  // texte libre ; `schoolYearLabel` conservé UNIQUEMENT pour dériver le même
  // id stable `seedId(...)` qu'avant cette itération (voir le commentaire
  // sur `SeededSchool` dans school.seed.ts).
  const { schoolYearId, schoolYearLabel } = school;
  const studentList = [...students.values()];

  for (const [index, student] of studentList.entries()) {
    const standardFee = feeLevelAmounts.get(student.classeName)?.amount ?? 100000;
    const discountAmount = index === DISCOUNTED_STUDENT_INDEX ? Math.round(standardFee * DISCOUNT_RATIO) : 0;
    const feeDue = standardFee - discountAmount;
    const ratio = PAYMENT_RATIOS[index % PAYMENT_RATIOS.length];
    const amountPaid = Math.round(feeDue * ratio);
    const id = seedId(`enrollment:${student.matricule}:${schoolYearLabel}`);

    await prisma.enrollment.upsert({
      where: { id },
      update: {
        feeDue,
        amountPaid,
        discountAmount,
        discountReason: discountAmount > 0 ? DISCOUNT_REASON : null,
        paymentMode: amountPaid > 0 ? PAYMENT_MODES[index % PAYMENT_MODES.length] : null,
        paymentDate: amountPaid > 0 ? new Date("2024-10-05") : null,
        status: computeStatus(feeDue, amountPaid),
      },
      create: {
        id,
        studentId: student.id,
        schoolYearId,
        feeDue,
        amountPaid,
        discountAmount,
        discountReason: discountAmount > 0 ? DISCOUNT_REASON : null,
        paymentMode: amountPaid > 0 ? PAYMENT_MODES[index % PAYMENT_MODES.length] : null,
        paymentDate: amountPaid > 0 ? new Date("2024-10-05") : null,
        status: computeStatus(feeDue, amountPaid),
      },
    });
  }
}
