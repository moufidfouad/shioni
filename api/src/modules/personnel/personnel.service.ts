import fs from "fs";
import path from "path";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { buildPaginationMeta, PaginationQuery, toSkipTake } from "../../utils/pagination";
import { env } from "../../config/env";
import type { StaffInput, UpdateStaffInput } from "./personnel.schema";


const STAFF_PHOTOS_DIR = path.join(process.cwd(), env.PHOTOS_UPLOADS_DIR, "staff");


function withHasPhoto<T extends { photoFileName: string | null; photoMimeType?: string | null }>(staff: T) {
  const { photoFileName, photoMimeType, ...rest } = staff;
  return { ...rest, hasPhoto: Boolean(photoFileName) };
}

export interface StaffFilters {
  search?: string;
  fonction?: string;
  statut?: string;
}

export async function listStaff(schoolId: string, opts: StaffFilters, pagination: PaginationQuery) {
  // `where` extrait dans une variable locale, réutilisée à l'identique par
  // le `findMany` (page courante) et le `count` (total) ci-dessous.
  const where = {
    schoolId,
    fullName: opts.search ? { contains: opts.search, mode: "insensitive" as const } : undefined,
    fonction: opts.fonction || undefined,
    statut: opts.statut || undefined,
  };

  const [staff, total] = await Promise.all([
    prisma.staffMember.findMany({
      where,
      orderBy: { fullName: "asc" },
      ...toSkipTake(pagination),
    }),
    prisma.staffMember.count({ where }),
  ]);

  return { data: staff.map(withHasPhoto), pagination: buildPaginationMeta(total, pagination) };
}

// Petites cartes de stats équivalentes à l'en-tête de la feuille "PERSONNEL"
// (total, actifs, total heures/semaine cumulées) — pas de moyenne/masse
// salariale affichée ici : `salaireBrut` reste visible uniquement fiche par
// fiche, pas agrégé dans un indicateur global.
export async function getStaffStats(schoolId: string) {
  const staff = await prisma.staffMember.findMany({
    where: { schoolId },
    select: { statut: true, heuresSemaine: true },
  });

  return {
    total: staff.length,
    actifs: staff.filter((s) => s.statut === "Actif").length,
    totalHeuresSemaine: staff.reduce((sum, s) => sum + (s.heuresSemaine ?? 0), 0),
  };
}

// Variante interne (non exportée) qui renvoie l'enregistrement Prisma BRUT
// (avec `photoFileName`) — réservée aux fonctions de ce module qui ont
// réellement besoin du nom de fichier disque (photo), même patron que
// students.service.ts::findStudentOrThrow.
async function findStaffOrThrow(schoolId: string, staffId: string) {
  const staff = await prisma.staffMember.findFirst({ where: { id: staffId, schoolId } });
  if (!staff) throw ApiError.notFound("Membre du personnel introuvable.");
  return staff;
}

export async function getStaffMember(schoolId: string, staffId: string) {
  const staff = await findStaffOrThrow(schoolId, staffId);
  return withHasPhoto(staff);
}

export async function createStaff(schoolId: string, input: StaffInput) {
  const staff = await prisma.staffMember.create({
    data: {
      schoolId,
      fullName: input.fullName,
      specialite: input.specialite,
      fonction: input.fonction,
      diplome: input.diplome,
      typeContrat: input.typeContrat,
      salaireBrut: input.salaireBrut,
      heuresSemaine: input.heuresSemaine,
      statut: input.statut ?? "Actif",
    },
  });
  return withHasPhoto(staff);
}

export async function updateStaff(schoolId: string, staffId: string, input: UpdateStaffInput) {
  await findStaffOrThrow(schoolId, staffId);
  const staff = await prisma.staffMember.update({ where: { id: staffId }, data: input });
  return withHasPhoto(staff);
}

export async function deleteStaff(schoolId: string, staffId: string) {
  await getStaffMember(schoolId, staffId);
  // Si ce membre est assigné comme enseignant sur des coefficients matière/
  // classe (`SubjectCoefficient.teacherId`), la relation est optionnelle côté
  // Prisma sans `onDelete` explicite -> action par défaut `SetNull` (relation
  // optionnelle) : ces coefficients perdent simplement leur enseignant
  // assigné, ils ne bloquent pas la suppression.
  await prisma.staffMember.delete({ where: { id: staffId } });
}

export async function setStaffPhoto(schoolId: string, staffId: string, file: Express.Multer.File) {
  const staff = await findStaffOrThrow(schoolId, staffId);
  if (staff.photoFileName) {
    fs.unlink(path.join(STAFF_PHOTOS_DIR, staff.photoFileName), () => undefined);
  }
  const updated = await prisma.staffMember.update({
    where: { id: staffId },
    data: { photoFileName: file.filename, photoMimeType: file.mimetype },
  });
  return withHasPhoto(updated);
}

export async function deleteStaffPhoto(schoolId: string, staffId: string) {
  const staff = await findStaffOrThrow(schoolId, staffId);
  if (staff.photoFileName) {
    fs.unlink(path.join(STAFF_PHOTOS_DIR, staff.photoFileName), () => undefined);
  }
  const updated = await prisma.staffMember.update({
    where: { id: staffId },
    data: { photoFileName: null, photoMimeType: null },
  });
  return withHasPhoto(updated);
}

export async function getStaffPhotoFile(schoolId: string, staffId: string) {
  const staff = await findStaffOrThrow(schoolId, staffId);
  if (!staff.photoFileName) throw ApiError.notFound("Aucune photo pour ce membre du personnel.");
  return {
    filePath: path.join(STAFF_PHOTOS_DIR, staff.photoFileName),
    mimeType: staff.photoMimeType || "application/octet-stream",
  };
}
