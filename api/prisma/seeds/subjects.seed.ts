import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SeededSchool } from "./school.seed";
import type { SeededGroupe } from "./structure.seed";
import type { SeededStaff } from "./personnel.seed";

export interface SeededSubject {
  id: string;
  name: string;
}

export interface SubjectDef {
  name: string;
  coefficient: number;
  hoursPerWeek: number;
  teacherSlug: string;
}

const SUBJECTS: SubjectDef[] = [
  { name: "Mathématiques", coefficient: 4, hoursPerWeek: 5, teacherSlug: "said-abdou" },
  { name: "Français", coefficient: 4, hoursPerWeek: 5, teacherSlug: "fatima-mohamed" },
  { name: "Anglais", coefficient: 3, hoursPerWeek: 4, teacherSlug: "ibrahim-soilihi" },
  { name: "SVT", coefficient: 2, hoursPerWeek: 2, teacherSlug: "halima-bacar" },
  { name: "Histoire-Géographie", coefficient: 2, hoursPerWeek: 3, teacherSlug: "toihir-hassane" },
];

// `Subject` upserté par `[schoolId, name]`, `SubjectCoefficient` par
// `[subjectId, groupeId]` (les deux `@@unique`) — déjà idempotents sans
// `seedId()`. Chaque matière est affectée au même enseignant dans les 3
// classes de démo (cas réel le plus courant : un professeur garde sa
// matière sur plusieurs classes d'un même niveau/cycle).
// Itération 47 — `subjectDefs` accepte désormais un cinquième paramètre
// optionnel (par défaut : les 5 matières d'ÉCOLE EXCELLENCE ci-dessus).
// Aucun risque de collision d'id ici (contrairement à personnel/timetable/
// finances) : `Subject`/`SubjectCoefficient` ont une vraie contrainte
// d'unicité SCOPÉE par école (`[schoolId, name]`/`[subjectId, groupeId]`),
// voir le commentaire plus haut.
export async function seedSubjects(
  prisma: PrismaClient,
  school: SeededSchool,
  groupes: Map<string, SeededGroupe>,
  staff: Map<string, SeededStaff>,
  subjectDefs: SubjectDef[] = SUBJECTS
): Promise<Map<string, SeededSubject>> {
  const subjects = new Map<string, SeededSubject>();

  for (const { name, coefficient, hoursPerWeek, teacherSlug } of subjectDefs) {
    const subject = await prisma.subject.upsert({
      where: { schoolId_name: { schoolId: school.id, name } },
      update: {},
      create: { schoolId: school.id, name, obligatoire: true },
    });
    subjects.set(name, { id: subject.id, name });

    const teacherId = staff.get(teacherSlug)?.id;
    for (const groupe of groupes.values()) {
      await prisma.subjectCoefficient.upsert({
        where: { subjectId_groupeId: { subjectId: subject.id, groupeId: groupe.id } },
        update: { coefficient, hoursPerWeek, teacherId },
        create: { subjectId: subject.id, groupeId: groupe.id, coefficient, hoursPerWeek, teacherId },
      });
    }
  }

  return subjects;
}
