import { z } from "zod";

// Couche "schema" : écolage mensuel (itération 34 — demande utilisateur,
// distincte du droit d'inscription annuel déjà couvert par le module
// `enrollments`). Une ligne = l'obligation d'écolage d'un élève pour UN mois
// d'une année scolaire donnée. `status` n'est jamais un champ d'entrée :
// toujours recalculé côté service (voir enrollments.service.ts::
// computeStatus, réutilisée telle quelle plutôt que dupliquée).

export const tuitionFeeSchema = z
  .object({
    studentId: z.string().uuid(),
    schoolYearId: z.string().uuid(),
    month: z.number().int().min(1).max(12),
    amountDue: z.number().nonnegative(),
    amountPaid: z.number().nonnegative().optional(),
    // Réduction négociée — même principe que `Enrollment.discountAmount` :
    // purement déclarative, jamais recalculée de force.
    discountAmount: z.number().nonnegative().optional(),
    discountReason: z.string().trim().max(500).optional(),
    paymentMode: z.string().optional(),
    paymentDate: z.string().optional(),
  })
  .refine((v) => !v.discountAmount || v.discountAmount <= 0 || Boolean(v.discountReason), {
    message: "Précisez le motif de la réduction accordée.",
    path: ["discountReason"],
  });

export const updateTuitionFeeSchema = z.object({
  amountDue: z.number().nonnegative().optional(),
  amountPaid: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  discountReason: z.string().trim().max(500).optional(),
  paymentMode: z.string().optional(),
  paymentDate: z.string().optional(),
});

// Même action dédiée "Enregistrer un paiement" que pour le droit
// d'inscription (incrémente `amountPaid`, ne l'écrase jamais).
export const recordTuitionPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMode: z.string().optional(),
  paymentDate: z.string().optional(),
});

// Génération en masse — cadrage explicite de l'utilisateur : "une ligne par
// mois, générée en masse" plutôt qu'une saisie manuelle mois par mois pour
// chaque élève. `groupeId` omis = toute l'école. `months` : la liste
// exacte des mois à générer (pas de calendrier scolaire présupposé, voir le
// commentaire de `TuitionFee.month` dans schema.prisma) — le frontend
// proposera par défaut les 12 mois cochés, modifiable avant envoi.
export const generateTuitionFeesSchema = z
  .object({
    schoolYearId: z.string().uuid(),
    groupeId: z.string().uuid().optional(),
    months: z.array(z.number().int().min(1).max(12)).min(1),
    // Réduction UNIFORME appliquée à chaque ligne générée par CET appel —
    // pour un ajustement individuel après coup, modifier la ligne
    // directement (PATCH) comme pour le droit d'inscription.
    discountAmount: z.number().nonnegative().optional(),
    discountReason: z.string().trim().max(500).optional(),
  })
  .refine((v) => !v.discountAmount || v.discountAmount <= 0 || Boolean(v.discountReason), {
    message: "Précisez le motif de la réduction accordée.",
    path: ["discountReason"],
  });

export type TuitionFeeInput = z.infer<typeof tuitionFeeSchema>;
export type UpdateTuitionFeeInput = z.infer<typeof updateTuitionFeeSchema>;
export type RecordTuitionPaymentInput = z.infer<typeof recordTuitionPaymentSchema>;
export type GenerateTuitionFeesInput = z.infer<typeof generateTuitionFeesSchema>;
