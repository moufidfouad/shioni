import { z } from "zod";

// Couche "schema" : reflète la feuille Excel "PERSONNEL". `statut` reste une
// chaîne libre côté Prisma (`@default("Actif")`, pas un enum) — on la laisse
// telle quelle ici plutôt que de la contraindre à une liste fermée non
// demandée ; la valeur par défaut est appliquée dans le service si absente.

export const staffSchema = z.object({
  fullName: z.string().min(2),
  specialite: z.string().optional(),
  fonction: z.string().optional(),
  diplome: z.string().optional(),
  typeContrat: z.string().optional(),
  salaireBrut: z.number().nonnegative().optional(),
  heuresSemaine: z.number().int().nonnegative().optional(),
  statut: z.string().optional(),
});

export const updateStaffSchema = staffSchema.partial();

export type StaffInput = z.infer<typeof staffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
