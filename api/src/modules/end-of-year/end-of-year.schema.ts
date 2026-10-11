import { z } from "zod";
import { EndOfYearDecisionType } from "../../config/prisma";

// Couche "schema" : une décision de fin d'année pour UN élève et UNE année
// scolaire (voir schema.prisma::EndOfYearDecision pour le contexte complet
// de cadrage, quatre questions `AskUserQuestion` répondues à l'itération 43).
//
// `targetGroupeId` dépend de `decision` — pas une simple présence/absence,
// une vraie règle métier par valeur d'énumération, ce que Prisma/Postgres ne
// peuvent pas exprimer en contrainte de schéma :
//   - PASSAGE / REORIENTATION : EXIGÉ (impossible de "passer" ou
//     "réorienter" un élève sans destination).
//   - REDOUBLEMENT : optionnel (repli sur le groupe d'origine côté service
//     si omis — un redoublant reste par défaut dans son groupe actuel, mais
//     peut être explicitement replacé dans un groupe dédié aux redoublants
//     si l'école en a un).
//   - DEPART : INTERDIT (aucune destination pour un élève qui quitte
//     l'établissement — étiquette informative seulement, voir schema.prisma).
// `enrollmentSchoolYearId` — itération 44, demande utilisateur : "si passage
// en classe supérieure validée, l'élève est inscrit pour l'année suivante et
// doit donc un frais d'inscription. Si redoublement, de même. la
// réorientation ne concerne qu'un élève déjà inscrit [...]". Même logique de
// dépendance-par-valeur-d'énumération que `targetGroupeId` ci-dessus :
//   - PASSAGE / REDOUBLEMENT : EXIGÉ — l'année de la nouvelle inscription,
//     TOUJOURS choisie/confirmée par le personnel (cadrage AskUserQuestion,
//     itération 44 : jamais déduite silencieusement).
//   - REORIENTATION / DEPART : INTERDIT — ni l'un ni l'autre ne génère de
//     nouvelle inscription (l'élève est déjà inscrit cette année pour
//     REORIENTATION ; DEPART reste une étiquette informative seulement).
export const endOfYearDecisionSchema = z
  .object({
    studentId: z.string().uuid(),
    schoolYearId: z.string().uuid(),
    decision: z.nativeEnum(EndOfYearDecisionType),
    targetGroupeId: z.string().uuid().optional(),
    enrollmentSchoolYearId: z.string().uuid().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) => v.decision !== "DEPART" || !v.targetGroupeId,
    { message: "Un départ vers un autre établissement n'a pas de classe de destination.", path: ["targetGroupeId"] }
  )
  .refine(
    (v) => (v.decision !== "PASSAGE" && v.decision !== "REORIENTATION") || Boolean(v.targetGroupeId),
    { message: "Choisissez la classe de destination.", path: ["targetGroupeId"] }
  )
  .refine(
    (v) => (v.decision !== "PASSAGE" && v.decision !== "REDOUBLEMENT") || Boolean(v.enrollmentSchoolYearId),
    { message: "Choisissez l'année scolaire de la nouvelle inscription.", path: ["enrollmentSchoolYearId"] }
  )
  .refine(
    (v) => (v.decision !== "REORIENTATION" && v.decision !== "DEPART") || !v.enrollmentSchoolYearId,
    {
      message: "Une réorientation ou un départ ne génère pas de nouvelle inscription.",
      path: ["enrollmentSchoolYearId"],
    }
  );

export type EndOfYearDecisionInput = z.infer<typeof endOfYearDecisionSchema>;
