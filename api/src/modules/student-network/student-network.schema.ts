import { z } from "zod";

// Itération 46 — recherche inter-écoles par l'un des deux identifiants
// externes d'un élève (voir le commentaire sur `Student.nationalIdNumber`/
// `ministryStudentNumber` dans schema.prisma). Exactement UN des deux champs
// doit être fourni — jamais les deux à la fois (ambigu : que faire si les
// deux ne pointent pas vers le même élève ?), jamais aucun (rien à
// chercher). Le format lui-même reste libre (voir students.schema.ts) : pas
// de contrainte supplémentaire ici au-delà de la présence exclusive.
export const studentNetworkSearchSchema = z
  .object({
    nationalIdNumber: z.string().trim().min(1).optional(),
    ministryStudentNumber: z.string().trim().min(1).optional(),
  })
  .refine((v) => Boolean(v.nationalIdNumber) !== Boolean(v.ministryStudentNumber), {
    message:
      "Fournir soit un numéro de carte d'identité nationale, soit un numéro d'élève (ministère) — jamais les deux à la fois, jamais aucun.",
    path: ["nationalIdNumber"],
  });

export type StudentNetworkSearchInput = z.infer<typeof studentNetworkSearchSchema>;
