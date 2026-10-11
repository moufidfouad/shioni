import { z } from "zod";
import { islandSchema, optionalComorosPhoneSchema } from "../../utils/comoros";

export const schoolSchema = z.object({
  name: z.string().min(2),
  director: z.string().optional(),
  address: z.string().optional(),
  // Île de l'Union des Comores (voir utils/comoros.ts) — facultative : une
  // école n'a pas toujours renseigné son île au moment de sa création.
  island: islandSchema.optional().or(z.literal("")),
  phone: optionalComorosPhoneSchema,
  email: z.string().email().optional().or(z.literal("")),
  arreteNumber: z.string().optional(),
  // Itération 44 — l'ancien champ texte libre `schoolYear` ("2024-2025") est
  // retiré d'ici : l'année scolaire "courante" de l'école est désormais
  // gérée exclusivement via `parameters.service.ts::setCurrentSchoolYear`
  // (onglet "Années scolaires" de la page Structure pédagogique), qui
  // référence une VRAIE `SchoolYear` existante plutôt qu'un texte libre —
  // ce formulaire générique "informations de l'école" n'a plus lieu de
  // porter ce champ.
  currency: z.string().optional(),
  cycle: z.string().optional(),
});

export const updateSchoolSchema = schoolSchema.partial();

export type CreateSchoolInput = z.infer<typeof schoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
