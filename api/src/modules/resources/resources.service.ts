import fs from "fs";
import path from "path";
import { prisma, ResourceType } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { env } from "../../config/env";
import type {
  CreateDocumentResourceInput,
  CreateVideoResourceInput,
  UpdateResourceInput,
} from "./resources.schema";

const resourceInclude = {
  subjects: { include: { subject: { select: { id: true, name: true } } } },
  classes: { include: { classe: { select: { id: true, name: true } } } },
  publishedBy: { select: { id: true, fullName: true } },
} as const;

async function assertSubjectsInSchool(schoolId: string, subjectIds: string[]) {
  const count = await prisma.subject.count({
    where: { schoolId, id: { in: subjectIds } },
  });
  if (count !== subjectIds.length) {
    throw ApiError.badRequest(
      "Une ou plusieurs matières sont introuvables dans cette école.",
    );
  }
}

async function assertClassesInSchool(schoolId: string, classeIds: string[]) {
  const count = await prisma.classe.count({
    where: { schoolId, id: { in: classeIds } },
  });
  if (count !== classeIds.length) {
    throw ApiError.badRequest(
      "Une ou plusieurs classes sont introuvables dans cette école.",
    );
  }
}

export async function listResources(schoolId: string) {
  return prisma.resource.findMany({
    where: { schoolId },
    include: resourceInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getResource(schoolId: string, resourceId: string) {
  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, schoolId },
    include: resourceInclude,
  });
  if (!resource) throw ApiError.notFound("Ressource introuvable.");
  return resource;
}

export async function createVideoResource(
  schoolId: string,
  userId: string,
  input: CreateVideoResourceInput,
) {
  await assertSubjectsInSchool(schoolId, input.subjectIds);
  await assertClassesInSchool(schoolId, input.classeIds);

  return prisma.resource.create({
    data: {
      schoolId,
      title: input.title,
      description: input.description,
      type: ResourceType.VIDEO,
      videoUrl: input.videoUrl,
      published: input.published ?? true,
      publishedById: userId,
      subjects: {
        create: input.subjectIds.map((subjectId) => ({ subjectId })),
      },
      classes: { create: input.classeIds.map((classeId) => ({ classeId })) },
    },
    include: resourceInclude,
  });
}

export async function createDocumentResource(
  schoolId: string,
  userId: string,
  input: CreateDocumentResourceInput,
  file: Express.Multer.File,
) {
  await assertSubjectsInSchool(schoolId, input.subjectIds);
  await assertClassesInSchool(schoolId, input.classeIds);

  return prisma.resource.create({
    data: {
      schoolId,
      title: input.title,
      description: input.description,
      type: ResourceType.DOCUMENT,
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      published: input.published ?? true,
      publishedById: userId,
      subjects: {
        create: input.subjectIds.map((subjectId) => ({ subjectId })),
      },
      classes: { create: input.classeIds.map((classeId) => ({ classeId })) },
    },
    include: resourceInclude,
  });
}

export async function updateResource(
  schoolId: string,
  resourceId: string,
  input: UpdateResourceInput,
) {
  const resource = await getResource(schoolId, resourceId);

  if (input.videoUrl !== undefined && resource.type !== ResourceType.VIDEO) {
    throw ApiError.badRequest(
      "videoUrl ne s'applique qu'aux ressources de type VIDEO.",
    );
  }
  if (input.subjectIds)
    await assertSubjectsInSchool(schoolId, input.subjectIds);
  if (input.classeIds) await assertClassesInSchool(schoolId, input.classeIds);

  return prisma.$transaction(async (tx) => {
    // Remplacement complet des liens matières/classes (pas de diff fin,
    // même patron additif-puis-remplacé que `subjects.service.ts::
    // setCoefficients`, mais ici le tableau reçu représente TOUJOURS
    // l'ensemble complet voulu, pas un ajout partiel) — seulement si le
    // champ a été envoyé (`undefined` = "ne pas toucher", même convention
    // Prisma que le reste du projet).
    if (input.subjectIds) {
      await tx.resourceSubject.deleteMany({ where: { resourceId } });
      await tx.resourceSubject.createMany({
        data: input.subjectIds.map((subjectId) => ({ resourceId, subjectId })),
      });
    }
    if (input.classeIds) {
      await tx.resourceClasse.deleteMany({ where: { resourceId } });
      await tx.resourceClasse.createMany({
        data: input.classeIds.map((classeId) => ({ resourceId, classeId })),
      });
    }

    return tx.resource.update({
      where: { id: resourceId },
      data: {
        title: input.title,
        description: input.description,
        published: input.published,
        videoUrl: input.videoUrl,
      },
      include: resourceInclude,
    });
  });
}

// Téléchargement AUTHENTIFIÉ (tout membre de l'école, même garde que list/
// getOne) — distinct de `publicResources.service.ts::getPublicResourceFile`,
// qui exige en plus `published: true`. Utile au personnel pour prévisualiser
// un document PAS ENCORE publié (avant de le rendre visible au public).
export async function getResourceFile(schoolId: string, resourceId: string) {
  const resource = await getResource(schoolId, resourceId);
  if (resource.type !== ResourceType.DOCUMENT || !resource.fileName) {
    throw ApiError.notFound("Ce n'est pas un document téléchargeable.");
  }

  const filePath = path.join(
    process.cwd(),
    env.RESOURCES_UPLOADS_DIR,
    resource.fileName,
  );
  if (!fs.existsSync(filePath))
    throw ApiError.notFound("Fichier introuvable sur le serveur.");

  return {
    filePath,
    fileName: resource.originalName ?? resource.fileName,
    mimeType: resource.mimeType ?? "application/octet-stream",
  };
}

export async function deleteResource(schoolId: string, resourceId: string) {
  const resource = await getResource(schoolId, resourceId);

  await prisma.resource.delete({ where: { id: resourceId } });

  // Best-effort : la suppression en base est déjà actée, un fichier orphelin
  // sur disque n'est jamais bloquant (même choix que le reste du projet —
  // aucune tâche de nettoyage périodique n'existe pour les pièces jointes de
  // la messagerie non plus).
  if (resource.type === ResourceType.DOCUMENT && resource.fileName) {
    const filePath = path.join(
      process.cwd(),
      env.RESOURCES_UPLOADS_DIR,
      resource.fileName,
    );
    fs.unlink(filePath, () => undefined);
  }
}
