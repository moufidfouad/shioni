import type { PrismaClient } from "../../src/generated/prisma/client";
import { DEMO_SCHOOL_ID } from "./school.seed";
import type { SeededSchool } from "./school.seed";
import type { SeededGroupe, SeededSalle } from "./structure.seed";
import type { SeededStaff } from "./personnel.seed";
import { seedId } from "./ids";

// Itération 47 — type exporté (jusque-là un littéral anonyme), pour que les
// nouvelles écoles définissent leur propre grille de démo.
export interface TimetableEntryDef {
  className: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  teacherSlug: string;
  salle: string;
}

// `TimetableEntry` n'a pas de contrainte d'unicité en base : upsert sur un
// id dérivé de `classe + jour + heure de début`. La grille ci-dessous est
// choisie à la main pour ne jamais violer les règles que l'application
// applique elle-même à l'écriture (`timetable.service.ts::assertNoConflict`,
// itération 16) : un même enseignant n'apparaît jamais deux fois au même
// jour ET à la même heure, même sur des classes différentes — et, itération
// 35, une même SALLE non plus (voir `assertNoConflict`, étendu à la salle).
// Concrètement, cette grille ne place jamais deux créneaux au même
// (jour, heure de début) tous groupes confondus, donc l'attribution de
// salle ci-dessous ne peut jamais entrer en conflit, quel que soit le choix.
//
// Itération 35 — `salle` : chaque groupe garde en général "sa" salle
// (cohérent avec la pratique réelle d'un établissement — une classe reste
// dans son local), sauf les créneaux de SVT, déplacés au "Labo Sciences"
// (thématiquement cohérent) — pour illustrer une VRAIE diversité
// d'occupation de salles dans le futur tableau de bord d'analyse, sans
// pour autant réserver "Salle Informatique" (démontre aussi l'état "salle
// configurée mais pas encore utilisée").
// Itération 35 — 2 nouveaux créneaux pour "4ème B" (nouveau groupe, voir
// `structure.seed.ts`), à des horaires DÉCALÉS de "4ème A" pour ne
// provoquer aucun double-booking enseignant (said-abdou/fatima-mohamed
// interviennent déjà sur "4ème A" à d'autres heures ce même jour).
const SCHEDULE: TimetableEntryDef[] = [
  { className: "6ème A", day: "Lundi", startTime: "07h30", endTime: "08h30", subject: "Mathématiques", teacherSlug: "said-abdou", salle: "Salle 1" },
  { className: "6ème A", day: "Mardi", startTime: "08h30", endTime: "09h30", subject: "Français", teacherSlug: "fatima-mohamed", salle: "Salle 1" },
  { className: "6ème A", day: "Mercredi", startTime: "07h30", endTime: "08h30", subject: "Anglais", teacherSlug: "ibrahim-soilihi", salle: "Salle 1" },
  { className: "6ème A", day: "Jeudi", startTime: "09h30", endTime: "10h30", subject: "SVT", teacherSlug: "halima-bacar", salle: "Labo Sciences" },

  { className: "5ème A", day: "Lundi", startTime: "08h30", endTime: "09h30", subject: "Mathématiques", teacherSlug: "said-abdou", salle: "Salle 2" },
  { className: "5ème A", day: "Mardi", startTime: "07h30", endTime: "08h30", subject: "Français", teacherSlug: "fatima-mohamed", salle: "Salle 2" },
  { className: "5ème A", day: "Mercredi", startTime: "08h30", endTime: "09h30", subject: "Anglais", teacherSlug: "ibrahim-soilihi", salle: "Salle 2" },
  { className: "5ème A", day: "Jeudi", startTime: "07h30", endTime: "08h30", subject: "Histoire-Géographie", teacherSlug: "toihir-hassane", salle: "Salle 2" },

  { className: "4ème A", day: "Lundi", startTime: "09h30", endTime: "10h30", subject: "Mathématiques", teacherSlug: "said-abdou", salle: "Salle 3" },
  { className: "4ème A", day: "Mardi", startTime: "09h30", endTime: "10h30", subject: "Français", teacherSlug: "fatima-mohamed", salle: "Salle 3" },
  { className: "4ème A", day: "Mercredi", startTime: "09h30", endTime: "10h30", subject: "SVT", teacherSlug: "halima-bacar", salle: "Labo Sciences" },
  { className: "4ème A", day: "Jeudi", startTime: "08h30", endTime: "09h30", subject: "Anglais", teacherSlug: "ibrahim-soilihi", salle: "Salle 3" },

  { className: "4ème B", day: "Lundi", startTime: "10h30", endTime: "11h30", subject: "Mathématiques", teacherSlug: "said-abdou", salle: "Salle 4" },
  { className: "4ème B", day: "Mardi", startTime: "10h30", endTime: "11h30", subject: "Français", teacherSlug: "fatima-mohamed", salle: "Salle 4" },
];

// Itération 47 — `schedule` accepte désormais un sixième paramètre optionnel
// (par défaut : la grille d'ÉCOLE EXCELLENCE ci-dessus). `keyScope` (même
// principe que `personnel.seed.ts`) : `timetable:${classe}:${jour}:${heure}`
// ne dépend d'aucun identifiant d'école — une nouvelle école dont un groupe
// porte un nom de classe déjà utilisé ailleurs (ex. "6ème A", vocabulaire
// volontairement partagé pour réutiliser le même barème `FeeLevel`, voir
// `parameters.seed.ts`) produirait sinon un id identique à un créneau
// d'ÉCOLE EXCELLENCE au même jour/à la même heure, et écraserait sa salle/
// son enseignant au lieu de créer sa propre ligne. Omis pour `DEMO_SCHOOL_ID`
// afin de ne pas changer les ids déjà attribués à sa propre grille.
export async function seedTimetable(
  prisma: PrismaClient,
  school: SeededSchool,
  groupes: Map<string, SeededGroupe>,
  staff: Map<string, SeededStaff>,
  salles: Map<string, SeededSalle>,
  schedule: TimetableEntryDef[] = SCHEDULE
) {
  const keyScope = school.id === DEMO_SCHOOL_ID ? "" : `${school.id}:`;
  for (const entry of schedule) {
    const groupe = groupes.get(entry.className);
    if (!groupe) throw new Error(`Classe inconnue dans le seed emploi du temps : "${entry.className}"`);
    const salle = salles.get(entry.salle);
    if (!salle) throw new Error(`Salle inconnue dans le seed emploi du temps : "${entry.salle}"`);
    const teacherStaff = staff.get(entry.teacherSlug);
    const teacherName = teacherStaff?.fullName ?? null;
    // Itération 30 — `teacherId` (FK ajoutée au schéma à l'itération 29,
    // source de vérité pour le filtrage fin Enseignant, voir
    // `teacherScope.ts`) renseigné en plus du `teacherName` texte libre déjà
    // affiché : chaque créneau de cette grille de démo correspond à un
    // membre du personnel réellement enregistré (`personnel.seed.ts`), donc
    // rien n'empêche de le lier dès la création plutôt que de compter sur
    // la résolution best-effort par nom (`resolveTeacherIdFromName`, pensée
    // pour un `ADMIN` qui saisit encore du texte libre a posteriori).
    const teacherId = teacherStaff?.id ?? null;
    const id = seedId(`${keyScope}timetable:${entry.className}:${entry.day}:${entry.startTime}`);

    await prisma.timetableEntry.upsert({
      where: { id },
      update: { endTime: entry.endTime, subjectName: entry.subject, teacherName, teacherId, salleId: salle.id },
      create: {
        id,
        schoolId: school.id,
        groupeId: groupe.id,
        day: entry.day,
        startTime: entry.startTime,
        endTime: entry.endTime,
        subjectName: entry.subject,
        teacherName,
        teacherId,
        salleId: salle.id,
      },
    });
  }
}
