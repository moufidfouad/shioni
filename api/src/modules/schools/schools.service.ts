import fs from "fs";
import path from "path";
import { prisma, SchoolRole } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { env } from "../../config/env";
import type { CreateSchoolInput, UpdateSchoolInput } from "./schools.schema";

// Itération 64 — logo d'école : même patron que students.service.ts::
// STUDENT_PHOTOS_DIR (voir son commentaire pour le raisonnement complet).
const SCHOOL_LOGOS_DIR = path.join(process.cwd(), env.PHOTOS_UPLOADS_DIR, "schools");

// Itération 64 — jamais exposer `logoFileName`/`logoMimeType` bruts au
// frontend, même patron que students.service.ts::withHasPhoto (voir son
// commentaire).
function withHasLogo<T extends { logoFileName: string | null; logoMimeType?: string | null }>(school: T) {
  const { logoFileName, logoMimeType, ...rest } = school;
  return { ...rest, hasLogo: Boolean(logoFileName) };
}

// Un utilisateur peut créer autant d'écoles qu'il veut. Dès la création, il
// devient automatiquement ADMIN de cette école (sinon il ne pourrait plus
// rien y gérer) et des paramètres pédagogiques par défaut sont initialisés.
export async function createSchool(userId: string, input: CreateSchoolInput) {
  const school = await prisma.$transaction(async (tx) => {
    const created = await tx.school.create({
      data: { ...input, createdById: userId },
    });

    await tx.schoolMembership.create({
      data: { userId, schoolId: created.id, role: SchoolRole.ADMIN },
    });

    await tx.schoolParameters.create({
      data: { schoolId: created.id },
    });

    return created;
  });
  return withHasLogo(school);
}

// Itération 44 — `currentSchoolYear` inclus pour que le frontend affiche un
// libellé ("2025-2026") plutôt que l'id technique : `School.schoolYear`
// (texte libre) n'existe plus, remplacé par `currentSchoolYearId` (FK, voir
// schema.prisma) — un `select` par défaut renverrait l'id mais jamais la
// relation.
const schoolListInclude = {
  _count: { select: { students: true, memberships: true } },
  currentSchoolYear: { select: { id: true, label: true } },
} as const;

// Écoles visibles par l'utilisateur : le superadmin voit tout, un
// utilisateur normal ne voit que les écoles où il a au moins un rôle —
// **et, depuis l'itération 27, les écoles où il est simplement lié comme
// Parent (StudentGuardian) à un élève, même sans aucun SchoolRole/
// SchoolMembership**, et depuis l'itération 31, les écoles où il est
// lui-même un Élève lié (Student.userId). `myRoles` reste vide pour ces
// écoles-là (ni un parent ni un élève n'ont de rôle de gestion) ; les champs
// `isGuardian`/`isStudent` indiquent au frontend qu'il s'agit d'un accès
// "portail" (parent ou élève) plutôt que d'un accès staff, pour que
// SchoolLayout affiche la bonne navigation.
export async function listSchoolsForUser(userId: string, isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    const schools = await prisma.school.findMany({
      orderBy: { createdAt: "desc" },
      include: schoolListInclude,
    });
    return schools.map(withHasLogo);
  }

  const [staffSchools, guardianLinks, studentLinks] = await Promise.all([
    prisma.school.findMany({
      where: { memberships: { some: { userId } } },
      orderBy: { createdAt: "desc" },
      include: schoolListInclude,
    }),
    prisma.studentGuardian.findMany({
      where: { userId },
      select: { student: { select: { schoolId: true } } },
    }),
    prisma.student.findMany({
      where: { userId },
      select: { schoolId: true },
    }),
  ]);

  const guardianSchoolIds = [...new Set(guardianLinks.map((g) => g.student.schoolId))];
  const studentSchoolIds = [...new Set(studentLinks.map((s) => s.schoolId))];
  const staffSchoolIds = new Set(staffSchools.map((s) => s.id));
  const portalOnlyIds = [...new Set([...guardianSchoolIds, ...studentSchoolIds])].filter(
    (id) => !staffSchoolIds.has(id)
  );

  const portalOnlySchools = portalOnlyIds.length
    ? await prisma.school.findMany({ where: { id: { in: portalOnlyIds } }, include: schoolListInclude })
    : [];

  const memberships = await prisma.schoolMembership.findMany({
    where: { userId, schoolId: { in: staffSchools.map((s) => s.id) } },
  });

  const guardianSchoolIdSet = new Set(guardianSchoolIds);
  const studentSchoolIdSet = new Set(studentSchoolIds);

  return [...staffSchools, ...portalOnlySchools].map((school) =>
    withHasLogo({
      ...school,
      myRoles: memberships.filter((m) => m.schoolId === school.id).map((m) => m.role),
      isGuardian: guardianSchoolIdSet.has(school.id),
      isStudent: studentSchoolIdSet.has(school.id),
    })
  );
}

// Variante interne (non exportée) qui renvoie l'enregistrement Prisma BRUT
// (avec `logoFileName`) — réservée aux fonctions de ce module qui ont
// réellement besoin du nom de fichier disque (logo), même patron que
// students.service.ts::findStudentOrThrow.
async function findSchoolOrThrow(schoolId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    include: { currentSchoolYear: { select: { id: true, label: true } } },
  });
  if (!school) throw ApiError.notFound("École introuvable.");
  return school;
}

// Itération 109 — correctif : `GET /schools/:schoolId` renvoyait l'école
// BRUTE, sans jamais calculer `myRoles`/`isGuardian`/`isStudent` (contrairement
// à `listSchoolsForUser` ci-dessus, qui les calcule pour `GET /schools`). Le
// web ne s'en apercevait jamais : `SchoolLayout.tsx` calcule ses propres
// `myRoles`/`isGuardian`/`isStudent` à partir de `useSchoolsQuery()` (la
// LISTE), et n'utilise `useSchoolQuery()` (ce détail) que pour le nom/logo de
// l'école — jamais pour ces trois champs. `mobile/app/(app)/schools/
// [schoolId]/dashboard.tsx`, lui, appelle directement `useSchoolQuery()` et
// branche son rendu (Personnel/Parent/Élève) sur ces trois champs : toujours
// `undefined` faute d'être calculés ici, donc TOUJOURS le cas "Aucun accès
// reconnu pour cette école", quel que soit le rôle réel de l'utilisateur.
// Correctif : calculer ces trois champs ici aussi, pour CET utilisateur et
// CETTE école (superadmin non concerné : jamais réellement membre d'une école,
// même choix que `listSchoolsForUser` qui ne les calcule pas non plus pour lui).
export async function getSchoolById(schoolId: string, userId: string, isSuperAdmin: boolean) {
  const school = await findSchoolOrThrow(schoolId);
  if (isSuperAdmin) return withHasLogo(school);

  const [memberships, guardianLink, studentLink] = await Promise.all([
    prisma.schoolMembership.findMany({ where: { userId, schoolId } }),
    prisma.studentGuardian.findFirst({ where: { userId, student: { schoolId } } }),
    prisma.student.findFirst({ where: { userId, schoolId } }),
  ]);

  return withHasLogo({
    ...school,
    myRoles: memberships.map((m) => m.role),
    isGuardian: Boolean(guardianLink),
    isStudent: Boolean(studentLink),
  });
}

export async function updateSchool(schoolId: string, input: UpdateSchoolInput) {
  await findSchoolOrThrow(schoolId);
  const school = await prisma.school.update({ where: { id: schoolId }, data: input });
  return withHasLogo(school);
}

export async function deleteSchool(schoolId: string) {
  await findSchoolOrThrow(schoolId);
  await prisma.school.delete({ where: { id: schoolId } });
}

// Itération 64 — logo d'école. Même patron que students.service.ts::
// setStudentPhoto/deleteStudentPhoto/getStudentPhotoFile (voir leurs
// commentaires) : suppression best-effort de l'ancien fichier, et lecture
// qui réutilise `findSchoolOrThrow` pour que l'accès au logo suive les
// mêmes règles que l'accès au détail de l'école
// (requireSchoolMemberOrGuardian).
export async function setSchoolLogo(schoolId: string, file: Express.Multer.File) {
  const school = await findSchoolOrThrow(schoolId);
  if (school.logoFileName) {
    fs.unlink(path.join(SCHOOL_LOGOS_DIR, school.logoFileName), () => undefined);
  }
  const updated = await prisma.school.update({
    where: { id: schoolId },
    data: { logoFileName: file.filename, logoMimeType: file.mimetype },
  });
  return withHasLogo(updated);
}

export async function deleteSchoolLogo(schoolId: string) {
  const school = await findSchoolOrThrow(schoolId);
  if (school.logoFileName) {
    fs.unlink(path.join(SCHOOL_LOGOS_DIR, school.logoFileName), () => undefined);
  }
  const updated = await prisma.school.update({
    where: { id: schoolId },
    data: { logoFileName: null, logoMimeType: null },
  });
  return withHasLogo(updated);
}

export async function getSchoolLogoFile(schoolId: string) {
  const school = await findSchoolOrThrow(schoolId);
  if (!school.logoFileName) throw ApiError.notFound("Aucun logo pour cette école.");
  return {
    filePath: path.join(SCHOOL_LOGOS_DIR, school.logoFileName),
    mimeType: school.logoMimeType || "application/octet-stream",
  };
}
