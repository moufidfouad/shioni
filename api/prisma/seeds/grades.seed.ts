import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SeededStudent } from "./students.seed";
import type { SeededSubject } from "./subjects.seed";
import { seedId } from "./ids";

// `Grade` est désormais une simple coquille (élève+matière+trimestre) sans
// contrainte d'unicité en base — upsert sur seedId(matricule+matière+
// trimestre), comme avant cette itération. Chaque évaluation PONDÉRÉE
// (`GradeEvaluation`, nouveau modèle de l'itération 20) est elle aussi
// upsertée sur son propre id dérivé, en ajoutant son libellé à la clé : deux
// évaluations distinctes d'un même (élève, matière, trimestre) ne peuvent
// donc jamais se percuter.
//
// Deux évaluations par trimestre, reprenant tel quel l'exemple donné par
// l'utilisateur pour la pondération : "Devoir" à 25 %, "Composition" à
// 75 %. Trimestre 1 : les deux sont renseignées (bulletin clos). Trimestre 2
// (= `trimestreEnCours` dans parameters.seed.ts) : seul "Devoir" est saisi,
// pour illustrer un bulletin en cours de remplissage — `computeAverage` du
// service ne considère que les évaluations réellement présentes (jamais 0
// pour celle qui manque encore).
//
// Notes générées par une formule déterministe (pas `Math.random()` : deux
// exécutions du seed doivent produire EXACTEMENT les mêmes valeurs).
function pseudoNote(studentIndex: number, subjectIndex: number, variant: number): number {
  return 8 + ((studentIndex * 7 + subjectIndex * 3 + variant * 5) % 11); // toujours entre 8 et 18
}

const EVALUATIONS = [
  { label: "Devoir", weight: 25, variant: 0 },
  { label: "Composition", weight: 75, variant: 1 },
] as const;

export async function seedGrades(
  prisma: PrismaClient,
  students: Map<string, SeededStudent>,
  subjects: Map<string, SeededSubject>
) {
  const subjectList = [...subjects.values()];
  const studentList = [...students.values()];

  for (const [studentIndex, student] of studentList.entries()) {
    for (const [subjectIndex, subject] of subjectList.entries()) {
      for (const trimestre of [1, 2] as const) {
        const gradeId = seedId(`grade:${student.matricule}:${subject.name}:${trimestre}`);
        await prisma.grade.upsert({
          where: { id: gradeId },
          update: {},
          create: { id: gradeId, studentId: student.id, subjectId: subject.id, trimestre },
        });

        // Trimestre 2 : seule la première évaluation ("Devoir") est saisie.
        const evaluationsForTrimestre = trimestre === 1 ? EVALUATIONS : EVALUATIONS.slice(0, 1);
        for (const evaluation of evaluationsForTrimestre) {
          const evaluationId = seedId(
            `gradeEvaluation:${student.matricule}:${subject.name}:${trimestre}:${evaluation.label}`
          );
          const value = pseudoNote(studentIndex, subjectIndex, evaluation.variant);
          await prisma.gradeEvaluation.upsert({
            where: { id: evaluationId },
            update: { value, weight: evaluation.weight },
            create: {
              id: evaluationId,
              gradeId,
              label: evaluation.label,
              value,
              weight: evaluation.weight,
              order: EVALUATIONS.indexOf(evaluation),
            },
          });
        }
      }
    }
  }
}
