import { z } from "zod";
import { FinanceEntryType } from "../../config/prisma";

// Reflète la feuille Excel "FINANCES" : une écriture manuelle par mois
// (ex "RECETTES FRAIS SCOLAIRES", "LOYER & CHARGES LOCAUX"), typée recette
// ou charge. Contrairement à `Enrollment` (les frais élève par élève), ce
// module couvre les grandes lignes budgétaires globales de l'école — les
// deux alimentent ensemble le Tableau de bord (voir dashboard.service.ts)
// sans se recouvrir : `Enrollment` reste la source des frais de scolarité
// par élève, `FinanceEntry` celle des autres recettes/charges (loyer,
// salaires versés, dons, etc.).
export const financeEntrySchema = z.object({
  type: z.nativeEnum(FinanceEntryType),
  label: z.string().trim().min(1, "Le libellé est requis."),
  month: z.number().int().min(1, "Mois invalide.").max(12, "Mois invalide."),
  year: z.number().int().min(2000, "Année invalide.").max(2100, "Année invalide."),
  amount: z.number().positive("Le montant doit être positif."),
});

export const updateFinanceEntrySchema = financeEntrySchema.partial();

export type FinanceEntryInput = z.infer<typeof financeEntrySchema>;
export type UpdateFinanceEntryInput = z.infer<typeof updateFinanceEntrySchema>;
