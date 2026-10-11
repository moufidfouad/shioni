import { z } from "zod";

// Couche "schema" : reflète la feuille Excel "NOTES & BULLETINS".
//
// Depuis cette itération, une note n'est plus un simple champ note1/note2/
// note3 à moyenne arithmétique : chaque évaluation saisie porte sa propre
// PONDÉRATION, qui pèse dans le calcul de la moyenne de la matière (demande
// explicite : "une note est saisie avec sa pondération correspondante ...
// ex. une note de 75% ou une autre de 25%"). Un `Grade` (élève + matière +
// trimestre) regroupe donc une liste libre d'évaluations (`GradeEvaluation`
// côté Prisma), chacune avec un libellé, une valeur et un poids — voir
// grades.service.ts::computeAverage pour le calcul Σ(valeur×poids)/Σ(poids).
// La moyenne, la mention et le rang restent des calculs à la lecture,
// jamais des champs d'entrée ni des colonnes stockées.

export const evaluationSchema = z.object({
  label: z.string().min(1, "Le libellé de l'évaluation est requis."),
  value: z.number().nonnegative(),
  // Poids RELATIF (pas forcément un pourcentage sommant à 100) : la moyenne
  // se normalise par la somme des poids réellement saisis, pour qu'un
  // trimestre en cours de remplissage reste un calcul valide plutôt qu'une
  // moyenne biaisée par un poids "manquant".
  weight: z.number().positive("Le poids doit être strictement positif."),
});

export const gradeSchema = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  trimestre: z.number().int().positive(),
  evaluations: z.array(evaluationSchema).default([]),
});

// Remplace ENTIÈREMENT la liste des évaluations d'un `Grade` (pas de diff
// automatique, comme partout ailleurs dans ce projet où un upsert en masse
// ne supprime pas ce qui est absent du payload — sauf ici où le remplacement
// complet est le comportement voulu pour cet endpoint ciblé sur UN élève :
// omettre une évaluation dans le payload la supprime. Pour retirer une
// évaluation sur TOUTE une classe d'un coup, voir `deleteEvaluationSchema`
// plus bas, utilisé par l'endpoint dédié plutôt que ce remplacement complet
// élève par élève).
export const updateGradeSchema = z.object({
  evaluations: z.array(evaluationSchema),
});

// Saisie groupée : une classe + une matière + un trimestre + UNE évaluation
// (libellé + poids communs à toute la classe pour cette évaluation), une
// valeur par élève. Reflète le vrai workflow d'un enseignant qui ouvre "son"
// devoir pour toute la classe d'un coup plutôt qu'élève par élève — même
// principe que `setCoefficients` (itération 7). Rejouer cet appel avec le
// même libellé MET À JOUR l'évaluation déjà existante pour chaque élève
// plutôt que d'en créer une doublon (voir
// grades.service.ts::bulkSetGradeEvaluation) : c'est ce qui permet de
// corriger une note après coup sans passer par l'édition élève par élève.
// `value: null` pour un élève retire son évaluation de ce libellé si elle
// existait déjà (ou ne fait rien si elle n'existait pas encore) — c'est
// l'équivalent d'une case laissée vide dans le tableau de saisie.
export const bulkGradeEvaluationSchema = z.object({
  groupeId: z.string().uuid(),
  subjectId: z.string().uuid(),
  trimestre: z.number().int().positive(),
  label: z.string().min(1, "Le libellé de l'évaluation est requis."),
  weight: z.number().positive("Le poids doit être strictement positif."),
  entries: z.array(
    z.object({
      studentId: z.string().uuid(),
      value: z.number().nonnegative().nullable(),
    })
  ),
});

// Retire une évaluation identifiée par son libellé de TOUS les élèves d'une
// classe pour une matière/trimestre donné (ex. l'enseignant a créé "Devoir 2"
// par erreur et veut l'annuler entièrement plutôt que de repasser élève par
// élève).
export const deleteEvaluationSchema = z.object({
  groupeId: z.string().uuid(),
  subjectId: z.string().uuid(),
  trimestre: z.number().int().positive(),
  label: z.string().min(1),
});

export type EvaluationInput = z.infer<typeof evaluationSchema>;
export type GradeInput = z.infer<typeof gradeSchema>;
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>;
export type BulkGradeEvaluationInput = z.infer<typeof bulkGradeEvaluationSchema>;
export type DeleteEvaluationInput = z.infer<typeof deleteEvaluationSchema>;
