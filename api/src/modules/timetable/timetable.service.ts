import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { assertGroupeInScope, assertOwnTimetableEntry, TeacherScope } from "../../utils/teacherScope";
import { intersectGroupeIds, resolveGroupeIds, StructureFilter } from "../../utils/structureFilter";
import { TIMETABLE_DAYS, TimetableEntryInput, UpdateTimetableEntryInput } from "./timetable.schema";

const groupeInclude = {
  groupe: { select: { id: true, name: true } },
  // Itération 35 — demande utilisateur : "un créneau avec ... salle".
  salle: { select: { id: true, name: true } },
} as const;

async function assertGroupeInSchool(schoolId: string, groupeId: string) {
  const groupe = await prisma.groupe.findFirst({ where: { id: groupeId, schoolId } });
  if (!groupe) throw ApiError.notFound("Classe introuvable dans cette école.");
  return groupe;
}

async function assertSalleInSchool(schoolId: string, salleId: string) {
  const salle = await prisma.salle.findFirst({ where: { id: salleId, schoolId } });
  if (!salle) throw ApiError.notFound("Salle introuvable dans cette école.");
  return salle;
}

// Itération 29 — best-effort : quand un ADMIN saisit encore `teacherName` en
// texte libre (aucun nouveau champ de sélection ajouté au formulaire pour ne
// pas alourdir cet écran), on tente de retrouver la fiche StaffMember
// correspondante par correspondance EXACTE de nom (insensible à la casse) au
// sein de l'école, pour peupler `teacherId` et permettre au compte
// Enseignant concerné de voir/gérer ce créneau. Non-autoritaire : sans
// correspondance (nom mal orthographié, intervenant non enregistré comme
// Personnel...), le créneau garde simplement `teacherId: null`, comme avant
// cette itération.
async function resolveTeacherIdFromName(schoolId: string, teacherName: string | null | undefined): Promise<string | null> {
  const trimmed = teacherName?.trim();
  if (!trimmed) return null;
  const staff = await prisma.staffMember.findFirst({
    where: { schoolId, fullName: { equals: trimmed, mode: "insensitive" } },
  });
  return staff?.id ?? null;
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

// Trois garde-fous distincts contre les doubles réservations, vérifiés à la
// création et à la modification : une classe ne peut pas avoir deux cours en
// même temps, un même enseignant (si renseigné — champ texte libre, donc
// comparé insensible à la casse) ne peut pas être sur deux classes en même
// temps, et — itération 35, demande utilisateur ("un créneau avec ...
// salle") — une même salle (si assignée) ne peut pas accueillir deux cours
// en même temps. `id` exclut l'entrée en cours de modification de la
// comparaison.
async function assertNoConflict(
  schoolId: string,
  entry: {
    id?: string;
    groupeId: string;
    day: string;
    startTime: string;
    endTime: string;
    teacherName?: string | null;
    salleId?: string | null;
  }
) {
  const sameDay = await prisma.timetableEntry.findMany({
    where: { schoolId, day: entry.day, id: entry.id ? { not: entry.id } : undefined },
    include: groupeInclude,
  });

  const classConflict = sameDay.find(
    (e) => e.groupeId === entry.groupeId && timesOverlap(entry.startTime, entry.endTime, e.startTime, e.endTime)
  );
  if (classConflict) {
    throw ApiError.conflict(
      `Cette classe a déjà un cours (${classConflict.subjectName ?? "sans matière renseignée"}) le ${entry.day} sur ce créneau.`
    );
  }

  if (entry.teacherName) {
    const teacherConflict = sameDay.find(
      (e) =>
        e.teacherName?.trim().toLowerCase() === entry.teacherName!.trim().toLowerCase() &&
        timesOverlap(entry.startTime, entry.endTime, e.startTime, e.endTime)
    );
    if (teacherConflict) {
      throw ApiError.conflict(
        `${entry.teacherName} est déjà en cours le ${entry.day} sur ce créneau (classe ${teacherConflict.groupe.name}).`
      );
    }
  }

  if (entry.salleId) {
    const salleConflict = sameDay.find(
      (e) => e.salleId === entry.salleId && timesOverlap(entry.startTime, entry.endTime, e.startTime, e.endTime)
    );
    if (salleConflict) {
      throw ApiError.conflict(
        `${salleConflict.salle?.name ?? "Cette salle"} est déjà occupée le ${entry.day} sur ce créneau (classe ${salleConflict.groupe.name}).`
      );
    }
  }
}

function sortEntries<T extends { day: string; startTime: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const dayDiff =
      TIMETABLE_DAYS.indexOf(a.day as (typeof TIMETABLE_DAYS)[number]) -
      TIMETABLE_DAYS.indexOf(b.day as (typeof TIMETABLE_DAYS)[number]);
    return dayDiff !== 0 ? dayDiff : a.startTime.localeCompare(b.startTime);
  });
}

export interface TimetableFilters extends StructureFilter {
  day?: string;
  teacherName?: string;
  salleId?: string;
}

// `day` reste un simple `String` en base (pas d'enum, voir schema Prisma) :
// un `orderBy` Prisma le trierait alphabétiquement ("Jeudi" avant "Lundi")
// plutôt que dans l'ordre réel de la semaine — tri fait en JS après lecture.
//
// Itération 35 — `resolveGroupeIds` traduit un filtre cycle/classe/série/
// groupe en une liste concrète de `groupeId`, combinée (intersection
// implicite : `resolveGroupeIds` renvoie déjà `[opts.groupeId]` seul quand
// il est fourni) avec la portée d'un compte Enseignant le cas échéant.
export async function listTimetable(schoolId: string, opts: TimetableFilters, scope: TeacherScope | null = null) {
  if (scope && opts.groupeId) assertGroupeInScope(scope, opts.groupeId);
  const structureGroupeIds = await resolveGroupeIds(schoolId, opts);
  const scopeGroupeIds = scope ? Array.from(scope.groupeIds) : undefined;
  const finalGroupeIds = intersectGroupeIds(structureGroupeIds, scopeGroupeIds);
  const groupeFilter = finalGroupeIds ? { in: finalGroupeIds } : undefined;

  const entries = await prisma.timetableEntry.findMany({
    where: {
      schoolId,
      groupeId: groupeFilter,
      salleId: opts.salleId || undefined,
      day: opts.day || undefined,
      teacherName: opts.teacherName ? { contains: opts.teacherName, mode: "insensitive" } : undefined,
    },
    include: groupeInclude,
  });
  return sortEntries(entries);
}

async function getEntryRaw(schoolId: string, id: string) {
  const entry = await prisma.timetableEntry.findFirst({ where: { id, schoolId }, include: groupeInclude });
  if (!entry) throw ApiError.notFound("Créneau introuvable.");
  return entry;
}

// Lecture d'un créneau précis : accès complet à la classe (comme la liste),
// pas seulement à ses propres créneaux — un enseignant doit pouvoir
// consulter tout l'emploi du temps de ses classes, pas uniquement ses
// propres heures.
export async function getTimetableEntry(schoolId: string, id: string, scope: TeacherScope | null = null) {
  const entry = await getEntryRaw(schoolId, id);
  if (scope) assertGroupeInScope(scope, entry.groupeId);
  return entry;
}

export async function createTimetableEntry(
  schoolId: string,
  input: TimetableEntryInput,
  scope: TeacherScope | null = null
) {
  await assertGroupeInSchool(schoolId, input.groupeId);
  if (input.salleId) await assertSalleInSchool(schoolId, input.salleId);
  if (scope) assertGroupeInScope(scope, input.groupeId);
  if (input.startTime >= input.endTime) {
    throw ApiError.badRequest("L'heure de fin doit être après l'heure de début.");
  }

  // Un compte Enseignant scopé ne peut créer un créneau qu'à SON propre nom
  // — on force teacherId/teacherName côté serveur, quoi qu'ait envoyé le
  // payload (impossible d'attribuer un créneau à quelqu'un d'autre). Pour un
  // ADMIN, on tente une résolution best-effort de teacherId à partir du
  // teacherName texte libre saisi (voir resolveTeacherIdFromName).
  const teacherName = scope ? scope.staffMemberFullName : (input.teacherName ?? null);
  const teacherId = scope ? scope.staffMemberId : await resolveTeacherIdFromName(schoolId, input.teacherName);

  await assertNoConflict(schoolId, { ...input, teacherName });
  return prisma.timetableEntry.create({
    data: { schoolId, ...input, teacherName, teacherId },
    include: groupeInclude,
  });
}

export async function updateTimetableEntry(
  schoolId: string,
  id: string,
  input: UpdateTimetableEntryInput,
  scope: TeacherScope | null = null
) {
  const existing = await getEntryRaw(schoolId, id);
  if (scope) {
    // Restreint aux SEULS créneaux dont il est l'auteur déclaré, et
    // uniquement vers une classe où il intervient si la classe change.
    assertOwnTimetableEntry(scope, existing.teacherId);
    assertGroupeInScope(scope, input.groupeId ?? existing.groupeId);
  }
  if (input.groupeId) await assertGroupeInSchool(schoolId, input.groupeId);
  if (input.salleId) await assertSalleInSchool(schoolId, input.salleId);

  const teacherName = scope
    ? scope.staffMemberFullName
    : input.teacherName !== undefined
      ? input.teacherName
      : existing.teacherName;
  const teacherId = scope
    ? scope.staffMemberId
    : input.teacherName !== undefined && input.teacherName !== existing.teacherName
      ? await resolveTeacherIdFromName(schoolId, input.teacherName)
      : existing.teacherId;

  // Fusion avec l'existant pour valider le créneau final (chevauchement +
  // ordre heure de début/fin), même si la requête ne renvoie qu'un
  // sous-ensemble des champs (PATCH partiel).
  const merged = {
    groupeId: input.groupeId ?? existing.groupeId,
    day: input.day ?? existing.day,
    startTime: input.startTime ?? existing.startTime,
    endTime: input.endTime ?? existing.endTime,
    teacherName,
    salleId: input.salleId !== undefined ? input.salleId : existing.salleId,
  };
  if (merged.startTime >= merged.endTime) {
    throw ApiError.badRequest("L'heure de fin doit être après l'heure de début.");
  }
  await assertNoConflict(schoolId, { id, ...merged });

  return prisma.timetableEntry.update({
    where: { id },
    data: { ...input, teacherName, teacherId },
    include: groupeInclude,
  });
}

export async function deleteTimetableEntry(schoolId: string, id: string, scope: TeacherScope | null = null) {
  const existing = await getEntryRaw(schoolId, id);
  if (scope) assertOwnTimetableEntry(scope, existing.teacherId);
  await prisma.timetableEntry.delete({ where: { id } });
}

// Vue d'ensemble pour le Tableau de bord (itération 16) : nombre total de
// créneaux programmés, nombre de classes couvertes et d'enseignants
// distincts mentionnés (comparaison insensible à la casse, comme dans
// `assertNoConflict` — `teacherName` reste un champ texte libre).
export async function getTimetableOverview(schoolId: string) {
  const entries = await prisma.timetableEntry.findMany({
    where: { schoolId },
    select: { groupeId: true, teacherName: true },
  });
  return {
    totalEntries: entries.length,
    distinctClasses: new Set(entries.map((e) => e.groupeId)).size,
    distinctTeachers: new Set(
      entries.filter((e) => e.teacherName).map((e) => e.teacherName!.trim().toLowerCase())
    ).size,
  };
}
