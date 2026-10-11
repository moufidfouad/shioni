import { z } from "zod";

export const pedagogicalSchema = z.object({
  noteMax: z.number().optional(),
  notePassage: z.number().optional(),
  nbTrimestres: z.number().int().optional(),
  trimestreEnCours: z.number().int().optional(),
  nbHeuresSemaine: z.number().int().optional(),
  seuilBien: z.number().optional(),
  seuilTresBien: z.number().optional(),
  seuilExcellent: z.number().optional(),
});

// Itération 35 — `FeeLevel` référence désormais une `Classe` par FK
// (`classeId`) plutôt qu'un `levelName` texte libre (voir schema.prisma).
export const feeLevelSchema = z.object({
  classeId: z.string().uuid(),
  amount: z.number().nonnegative(),
  // Itération 34 — tarif mensuel d'écolage suggéré pour ce niveau (voir le
  // commentaire de `FeeLevel.monthlyAmount` dans schema.prisma). Optionnel :
  // un niveau peut ne pas encore avoir de tarif d'écolage défini.
  monthlyAmount: z.number().nonnegative().optional(),
  order: z.number().int().optional(),
});
export const feeLevelsSchema = z.array(feeLevelSchema);

// Itération 35 — structure pédagogique : Cycle -> Classe -> Série
// (optionnelle) -> Groupe, plus Salle (local physique, indépendant de cette
// hiérarchie). Voir schema.prisma pour le détail de chaque entité.
export const cycleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  order: z.number().int().optional(),
});

export const classeSchema = z.object({
  id: z.string().uuid().optional(),
  cycleId: z.string().uuid(),
  name: z.string().min(1),
  order: z.number().int().optional(),
});

export const serieSchema = z.object({
  id: z.string().uuid().optional(),
  classeId: z.string().uuid(),
  name: z.string().min(1),
  order: z.number().int().optional(),
});

export const groupeSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  classeId: z.string().uuid(),
  // Renseigné seulement quand ce groupe subdivise une série précise de la
  // classe (ex "Seconde L") — `null` explicite (et pas seulement absent) est
  // accepté pour permettre de "détacher" un groupe de sa série via une
  // modification (PATCH), voir parameters.service.ts::upsertGroupe.
  serieId: z.string().uuid().nullable().optional(),
  targetSize: z.number().int().nonnegative().optional(),
});

export const salleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  capacity: z.number().int().nonnegative().optional(),
  type: z.string().optional(),
});

// Itération 44 — "Années scolaires" : même patron que Cycle/Classe/Série/
// Groupe/Salle ci-dessus (upsert par présence d'un `id`, géré depuis l'écran
// "Structure pédagogique") plutôt qu'un module séparé — une année scolaire
// est une entité de référence de la même nature que ces cinq-là.
export const schoolYearSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1),
  order: z.number().int().optional(),
});

export type PedagogicalInput = z.infer<typeof pedagogicalSchema>;
export type FeeLevelInput = z.infer<typeof feeLevelSchema>;
export type CycleInput = z.infer<typeof cycleSchema>;
export type ClasseInput = z.infer<typeof classeSchema>;
export type SerieInput = z.infer<typeof serieSchema>;
export type GroupeInput = z.infer<typeof groupeSchema>;
export type SalleInput = z.infer<typeof salleSchema>;
export type SchoolYearInput = z.infer<typeof schoolYearSchema>;
