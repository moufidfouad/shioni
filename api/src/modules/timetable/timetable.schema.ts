import { z } from "zod";

// Reflète la feuille Excel "EMPLOI DU TEMPS" : une entrée = un créneau pour
// une classe (jour + heure de début/fin), avec matière et enseignant en
// texte libre plutôt qu'en référence à `Subject`/`StaffMember` — c'est le
// choix déjà fait dans le schéma Prisma (`TimetableEntry.subjectName`/
// `teacherName` sont de simples `String?`, modélisés dès l'itération 1) :
// un même emploi du temps mentionne parfois un intervenant ponctuel non
// inscrit au registre du personnel, donc pas de contrainte de clé étrangère
// ici. Le frontend suggère malgré tout les noms déjà connus (matières,
// personnel) via une `<datalist>` native, sans forcer la sélection.
export const TIMETABLE_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;

// Format "HHhMM" (ex "07h30"), heure zéro-préfixée sur 2 chiffres — reprend
// tel quel l'exemple déjà présent en commentaire du schéma Prisma. Ce format
// est imposé par validation zod (le modèle ne le contraint pas, `startTime`/
// `endTime` sont de simples `String`) car `timetable.service.ts` compare les
// créneaux par simple comparaison lexicographique de chaînes pour détecter
// les chevauchements — une comparaison qui ne donne un résultat correct que
// si toutes les heures sont bien sur 2 chiffres.
const timeRegex = /^([01]\d|2[0-3])h[0-5]\d$/;
const timeField = z.string().trim().regex(timeRegex, "Format attendu : HHhMM, ex. 07h30.");

export const timetableEntrySchema = z.object({
  groupeId: z.string().uuid(),
  day: z.enum(TIMETABLE_DAYS),
  startTime: timeField,
  endTime: timeField,
  subjectName: z.string().trim().min(1).optional(),
  teacherName: z.string().trim().min(1).optional(),
  // Itération 35 — demande utilisateur : "un créneau avec ... salle".
  // Optionnelle, comme sur le modèle Prisma (`TimetableEntry.salleId`) : un
  // créneau peut être saisi sans salle assignée.
  salleId: z.string().uuid().optional(),
});

// `subjectName`/`teacherName` acceptent explicitement `null` pour permettre
// de retirer une valeur déjà enregistrée (même patron que
// `updateAttendanceSchema`, itération 13) : `undefined` = "ne pas toucher",
// `null` = "effacer". `groupeId`/`day`/`startTime`/`endTime` restent de
// simples champs optionnels (non `nullable`) puisqu'ils sont obligatoires
// sur le modèle Prisma — impossible de les vider, seulement de les changer.
export const updateTimetableEntrySchema = z.object({
  groupeId: z.string().uuid().optional(),
  day: z.enum(TIMETABLE_DAYS).optional(),
  startTime: timeField.optional(),
  endTime: timeField.optional(),
  subjectName: z.string().trim().min(1).nullable().optional(),
  teacherName: z.string().trim().min(1).nullable().optional(),
  // `null` explicite retire la salle déjà assignée (même patron que
  // `subjectName`/`teacherName` ci-dessus).
  salleId: z.string().uuid().nullable().optional(),
});

export type TimetableEntryInput = z.infer<typeof timetableEntrySchema>;
export type UpdateTimetableEntryInput = z.infer<typeof updateTimetableEntrySchema>;
export type TimetableDay = (typeof TIMETABLE_DAYS)[number];
