import { z } from "zod";

// Couche "schema" : reflète la feuille Excel "MATIERES & COEFFICIENTS".
// `teacherId` (sur SubjectCoefficient dans le schéma Prisma) est désormais
// exposé : le module Personnel (feuille "PERSONNEL", itération 15) fournit
// l'API nécessaire pour valider qu'un `teacherId` donné existe dans l'école
// (voir `assertStaffInSchool` dans subjects.service.ts) — champ resté
// optionnel de bout en bout (une classe/matière n'a pas forcément encore
// d'enseignant assigné).

export const subjectSchema = z.object({
  name: z.string().min(1),
  obligatoire: z.boolean().optional(),
});

export const updateSubjectSchema = subjectSchema.partial();

export const coefficientSchema = z.object({
  groupeId: z.string().uuid(),
  coefficient: z.number().positive(),
  hoursPerWeek: z.number().int().nonnegative().optional(),
  teacherId: z.string().uuid().optional(),
});

export const coefficientsSchema = z.array(coefficientSchema);

export type SubjectInput = z.infer<typeof subjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type CoefficientInput = z.infer<typeof coefficientSchema>;
