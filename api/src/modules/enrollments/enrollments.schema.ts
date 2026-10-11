import { z } from "zod";

// Couche "schema" : reflète la feuille Excel "INSCRIPTIONS & FRAIS". Une
// ligne = l'inscription d'un élève pour une année scolaire donnée, avec ses
// frais dus et déjà payés. `status` n'est PAS un champ d'entrée : il est
// toujours recalculé côté service à partir de `feeDue`/`amountPaid` (voir
// enrollments.service.ts `computeStatus`) pour qu'il ne puisse jamais
// diverger des montants réels.

export const enrollmentSchema = z.object({
  studentId: z.string().uuid(),
  // Itération 44 — remplace l'ancien `schoolYear: z.string()` texte libre
  // par une vraie FK vers `SchoolYear` (voir schema.prisma), choisie sur un
  // combo côté frontend plutôt que tapée.
  schoolYearId: z.string().uuid(),
  feeDue: z.number().nonnegative(),
  amountPaid: z.number().nonnegative().optional(),
  // Réduction négociée (fratrie, bourse, enfant du personnel, difficulté
  // financière...) : purement déclarative, voir le commentaire sur
  // `Enrollment.discountAmount` dans schema.prisma. `discountReason` n'est
  // exigé que si un montant de réduction est renseigné (une réduction sans
  // justification n'a pas de sens pour un futur contrôle).
  discountAmount: z.number().nonnegative().optional(),
  discountReason: z.string().trim().max(500).optional(),
  paymentMode: z.string().optional(),
  paymentDate: z.string().optional(),
}).refine((v) => !v.discountAmount || v.discountAmount <= 0 || Boolean(v.discountReason), {
  message: "Précisez le motif de la réduction accordée.",
  path: ["discountReason"],
});

export const updateEnrollmentSchema = z.object({
  schoolYearId: z.string().uuid().optional(),
  feeDue: z.number().nonnegative().optional(),
  amountPaid: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  discountReason: z.string().trim().max(500).optional(),
  paymentMode: z.string().optional(),
  paymentDate: z.string().optional(),
});

// Action dédiée "Enregistrer un paiement" : incrémente `amountPaid` plutôt
// que de l'écraser (workflow réel d'un caissier qui reçoit des paiements
// successifs sur l'année), sur le même principe que `setCoefficients` pour
// les matières (une action métier au-delà du simple CRUD).
export const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMode: z.string().optional(),
  paymentDate: z.string().optional(),
});

export type EnrollmentInput = z.infer<typeof enrollmentSchema>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
