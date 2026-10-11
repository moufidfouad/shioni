import fs from "fs";
import path from "path";
import { prisma, Sex } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { generateNextMatricule } from "../../utils/matricule";
import { assertGroupeInScope, TeacherScope } from "../../utils/teacherScope";
import { buildPaginationMeta, PaginationQuery, toSkipTake } from "../../utils/pagination";
import { intersectGroupeIds, resolveGroupeIds, StructureFilter } from "../../utils/structureFilter";
import { env } from "../../config/env";
import type { StudentInput, UpdateStudentInput } from "./students.schema";


const STUDENT_PHOTOS_DIR = path.join(process.cwd(), env.PHOTOS_UPLOADS_DIR, "students");

function computeAge(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const diff = Date.now() - birthDate.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}


function withHasPhoto<T extends { photoFileName: string | null; photoMimeType?: string | null }>(student: T) {
  const { photoFileName, photoMimeType, ...rest } = student;
  return { ...rest, hasPhoto: Boolean(photoFileName) };
}


export interface ListStudentsFilters extends StructureFilter {
  sex?: Sex;
  search?: string;
}

export async function listStudents(
  schoolId: string,
  opts: ListStudentsFilters,
  scope: TeacherScope | null = null,
  pagination: PaginationQuery
) {
  if (scope && opts.groupeId) assertGroupeInScope(scope, opts.groupeId);

  const structureGroupeIds = await resolveGroupeIds(schoolId, opts);
  const scopeGroupeIds = scope ? Array.from(scope.groupeIds) : undefined;
  const finalGroupeIds = intersectGroupeIds(structureGroupeIds, scopeGroupeIds);
  const groupeFilter = finalGroupeIds ? { in: finalGroupeIds } : undefined;

  // `where` extrait dans une variable locale, réutilisée à l'identique par
  // le `findMany` (page courante) et le `count` (total) ci-dessous — évite
  // que les deux calculs divergent si un filtre est ajouté un jour à l'un
  // sans l'autre.
  const where = {
    schoolId,
    groupeId: groupeFilter,
    sex: opts.sex || undefined,
    fullName: opts.search ? { contains: opts.search, mode: "insensitive" as const } : undefined,
  };

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: { groupe: { select: { id: true, name: true } } },
      orderBy: { matricule: "asc" },
      ...toSkipTake(pagination),
    }),
    prisma.student.count({ where }),
  ]);

  return {
    data: students.map((s) => withHasPhoto({ ...s, age: computeAge(s.birthDate) })),
    pagination: buildPaginationMeta(total, pagination),
  };
}

// Petites cartes de stats équivalentes à l'en-tête de la feuille "ELEVES"
// (total, garçons, filles, âge moyen, nb classes).
export async function getStudentStats(schoolId: string) {
  const students = await prisma.student.findMany({ where: { schoolId }, select: { sex: true, birthDate: true } });
  const ages = students.map((s) => computeAge(s.birthDate)).filter((a): a is number => a !== null);
  const classCount = await prisma.groupe.count({ where: { schoolId } });

  return {
    total: students.length,
    boys: students.filter((s) => s.sex === "M").length,
    girls: students.filter((s) => s.sex === "F").length,
    averageAge: ages.length ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10 : null,
    classCount,
  };
}

// Variante interne (non exportée) qui renvoie l'enregistrement Prisma BRUT
// (avec `photoFileName`) — réservée aux fonctions de ce module qui ont
// réellement besoin du nom de fichier disque (photo). `getStudent`
// (exportée, ci-dessous) et `getStudentPhotoFile` partagent cette même
// vérification d'accès (portée Enseignant) sans dupliquer la requête Prisma.
async function findStudentOrThrow(schoolId: string, studentId: string, scope: TeacherScope | null) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: { groupe: true },
  });
  if (!student) throw ApiError.notFound("Élève introuvable.");
  // Élève sans classe (groupeId nul) : coalescé en "" pour un compte scopé
  // — n'appartenant à aucune classe du scope, l'accès est refusé (fail-closed).
  if (scope) assertGroupeInScope(scope, student.groupeId ?? "");
  return student;
}

export async function getStudent(schoolId: string, studentId: string, scope: TeacherScope | null = null) {
  const student = await findStudentOrThrow(schoolId, studentId, scope);
  return withHasPhoto({ ...student, age: computeAge(student.birthDate) });
}


export async function setStudentPhoto(schoolId: string, studentId: string, file: Express.Multer.File) {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
  if (!student) throw ApiError.notFound("Élève introuvable.");
  if (student.photoFileName) {
    fs.unlink(path.join(STUDENT_PHOTOS_DIR, student.photoFileName), () => undefined);
  }
  const updated = await prisma.student.update({
    where: { id: studentId },
    data: { photoFileName: file.filename, photoMimeType: file.mimetype },
  });
  return withHasPhoto({ ...updated, age: computeAge(updated.birthDate) });
}

export async function deleteStudentPhoto(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId } });
  if (!student) throw ApiError.notFound("Élève introuvable.");
  if (student.photoFileName) {
    fs.unlink(path.join(STUDENT_PHOTOS_DIR, student.photoFileName), () => undefined);
  }
  const updated = await prisma.student.update({
    where: { id: studentId },
    data: { photoFileName: null, photoMimeType: null },
  });
  return withHasPhoto({ ...updated, age: computeAge(updated.birthDate) });
}

export async function getStudentPhotoFile(schoolId: string, studentId: string, scope: TeacherScope | null) {
  const student = await findStudentOrThrow(schoolId, studentId, scope);
  if (!student.photoFileName) throw ApiError.notFound("Aucune photo pour cet élève.");
  return {
    filePath: path.join(STUDENT_PHOTOS_DIR, student.photoFileName),
    mimeType: student.photoMimeType || "application/octet-stream",
  };
}

async function assertExternalIdAvailable(
  schoolId: string,
  field: "nationalIdNumber" | "ministryStudentNumber",
  value: string | undefined,
  excludeStudentId?: string
) {
  if (!value) return; // toujours optionnel — rien à vérifier si absent
  const existing = await prisma.student.findFirst({
    where: { schoolId, [field]: value, id: excludeStudentId ? { not: excludeStudentId } : undefined },
    select: { id: true },
  });
  if (existing) {
    const label = field === "nationalIdNumber" ? "numéro de carte d'identité nationale" : "numéro d'élève (ministère)";
    throw ApiError.conflict(`Ce ${label} est déjà utilisé par un autre élève de cette école.`);
  }
}

export async function createStudent(schoolId: string, input: StudentInput) {
  const matricule = await generateNextMatricule(schoolId);
  await assertExternalIdAvailable(schoolId, "nationalIdNumber", input.nationalIdNumber);
  await assertExternalIdAvailable(schoolId, "ministryStudentNumber", input.ministryStudentNumber);
  const student = await prisma.student.create({
    data: {
      schoolId,
      matricule,
      fullName: input.fullName,
      birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
      birthPlace: input.birthPlace,
      sex: input.sex,
      parentName: input.parentName,
      parentPhone: input.parentPhone,
      nationalIdNumber: input.nationalIdNumber,
      ministryStudentNumber: input.ministryStudentNumber,
      groupeId: input.groupeId || undefined,
      notes: input.notes,
    },
  });
  return withHasPhoto({ ...student, age: computeAge(student.birthDate) });
}

export async function updateStudent(schoolId: string, studentId: string, input: UpdateStudentInput) {
  await getStudent(schoolId, studentId);
  await assertExternalIdAvailable(schoolId, "nationalIdNumber", input.nationalIdNumber, studentId);
  await assertExternalIdAvailable(schoolId, "ministryStudentNumber", input.ministryStudentNumber, studentId);
  const student = await prisma.student.update({
    where: { id: studentId },
    data: {
      ...input,
      birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
      groupeId: input.groupeId || undefined,
    },
  });
  return withHasPhoto({ ...student, age: computeAge(student.birthDate) });
}

export async function deleteStudent(schoolId: string, studentId: string) {
  await getStudent(schoolId, studentId);
  await prisma.student.delete({ where: { id: studentId } });
}
