import fs from "fs";
import path from "path";
import { prisma, ResourceType } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { env } from "../../config/env";
import { PaginationQuery, buildPaginationMeta, toSkipTake } from "../../utils/pagination";

// ----------------------------------------------------------------------------
// Itération 48 — partage de ressources au public. Volet PUBLIC (aucune
// authentification, voir app.ts/publicResources.routes.ts) : liste toutes
// les ressources PUBLIÉES de TOUTES les écoles, avec filtres cumulables.
//
// `Resource` n'est reliée qu'à `School` (obligatoire) et, en many-to-many, à
// `Subject`/`Classe` — jamais directement à `Serie`/`Cycle` (cadrage
// utilisateur, voir le commentaire d'en-tête du modèle `Resource` dans
// schema.prisma). `resolveClasseIds` ci-dessous fait donc remonter un filtre
// `serieId`/`cycleId` vers l'ensemble de classes équivalent AVANT de filtrer
// les ressources — c'est le même principe que `utils/structureFilter.ts::
// resolveGroupeIds`, mais un cran plus haut dans la hiérarchie (jusqu'à
// Classe, pas jusqu'à Groupe, puisque Resource ne connaît pas Groupe/Serie).
// ----------------------------------------------------------------------------

// Itération 50 — demande utilisateur : "permettre les select multiple" sur
// la page publique. Chaque dimension de filtre devient un tableau d'ids
// (plusieurs écoles/cycles/classes/séries/matières/types cumulables au sein
// d'une même dimension, combinées en ET entre dimensions différentes —
// inchangé). `schoolId`/`classeId`/... (singuliers) n'existent plus : voir
// le commentaire d'en-tête de `publicResources.controller.ts::list` pour le
// format de sérialisation côté requête (chaîne CSV, pas de tableau JSON).
export interface PublicResourcesFilter {
  schoolIds?: string[];
  classeIds?: string[];
  serieIds?: string[];
  cycleIds?: string[];
  subjectIds?: string[];
  types?: ResourceType[];
}

async function resolveClasseIds(filter: PublicResourcesFilter): Promise<string[] | undefined> {
  if (!filter.classeIds?.length && !filter.serieIds?.length && !filter.cycleIds?.length) return undefined;

  // Le filtre le plus précis gagne (même convention que resolveGroupeIds,
  // désormais pluralisée) : inutile d'interroger la base si `classeIds` est
  // déjà donné directement. Si l'utilisateur a coché une série ET une classe
  // simultanément (le frontend ne les exclut pas mutuellement — voir
  // PublicResourcesPage.tsx), seule la classe (plus précise) est retenue.
  if (filter.classeIds?.length) return filter.classeIds;

  if (filter.serieIds?.length) {
    const series = await prisma.serie.findMany({ where: { id: { in: filter.serieIds } }, select: { classeId: true } });
    // Aucune des séries demandées n'existe : résultat forcément vide
    // (tableau vide, PAS `undefined`, qui signifierait "aucun filtre" — voir
    // la distinction documentée dans structureFilter.ts).
    return series.map((s) => s.classeId);
  }

  const classes = await prisma.classe.findMany({ where: { cycleId: { in: filter.cycleIds } }, select: { id: true } });
  return classes.map((c) => c.id);
}

const publicResourceInclude = {
  school: { select: { id: true, name: true, island: true } },
  subjects: { include: { subject: { select: { id: true, name: true } } } },
  classes: { include: { classe: { select: { id: true, name: true, cycle: { select: { id: true, name: true } } } } } },
} as const;

export async function listPublicResources(filter: PublicResourcesFilter, pagination: PaginationQuery) {
  const classeIds = await resolveClasseIds(filter);
  // Un filtre classe/série/cycle qui ne correspond à AUCUNE classe donne un
  // résultat vide immédiat (in: [] ne matche jamais rien, mais autant courtcircuiter
  // la requête Prisma quand on sait déjà que where.classes ne matchera rien).
  if (classeIds && classeIds.length === 0) {
    return { data: [], pagination: buildPaginationMeta(0, pagination) };
  }

  const where = {
    published: true,
    schoolId: filter.schoolIds?.length ? { in: filter.schoolIds } : undefined,
    type: filter.types?.length ? { in: filter.types } : undefined,
    subjects: filter.subjectIds?.length ? { some: { subjectId: { in: filter.subjectIds } } } : undefined,
    classes: classeIds ? { some: { classeId: { in: classeIds } } } : undefined,
  };

  const [resources, total] = await Promise.all([
    prisma.resource.findMany({
      where,
      include: publicResourceInclude,
      orderBy: { createdAt: "desc" },
      ...toSkipTake(pagination),
    }),
    prisma.resource.count({ where }),
  ]);

  return { data: resources, pagination: buildPaginationMeta(total, pagination) };
}

export async function getPublicResource(resourceId: string) {
  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, published: true },
    include: publicResourceInclude,
  });
  if (!resource) throw ApiError.notFound("Ressource introuvable.");
  return resource;
}

export async function getPublicResourceFile(resourceId: string) {
  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, published: true, type: ResourceType.DOCUMENT },
  });
  if (!resource || !resource.fileName) throw ApiError.notFound("Document introuvable.");

  const filePath = path.join(process.cwd(), env.RESOURCES_UPLOADS_DIR, resource.fileName);
  if (!fs.existsSync(filePath)) throw ApiError.notFound("Fichier introuvable sur le serveur.");

  return {
    filePath,
    fileName: resource.originalName ?? resource.fileName,
    mimeType: resource.mimeType ?? "application/octet-stream",
  };
}

// Alimente les sélecteurs de filtre de la page publique. Simplification
// assumée (non re-confirmée avec l'utilisateur) : renvoie TOUTE la structure
// pédagogique de TOUTES les écoles, pas seulement celle des écoles ayant
// effectivement des ressources publiées — même choix que
// `subjects.service.ts::listSubjects`, qui renvoie déjà toutes les matières
// d'une école sans filtrer par "matière ayant au moins une note".
export async function listPublicFilterOptions() {
  const [schools, cycles, classes, series, subjects] = await Promise.all([
    prisma.school.findMany({ select: { id: true, name: true, island: true }, orderBy: { name: "asc" } }),
    prisma.cycle.findMany({ select: { id: true, name: true, schoolId: true }, orderBy: { order: "asc" } }),
    prisma.classe.findMany({ select: { id: true, name: true, cycleId: true, schoolId: true }, orderBy: { order: "asc" } }),
    prisma.serie.findMany({ select: { id: true, name: true, classeId: true, schoolId: true }, orderBy: { order: "asc" } }),
    prisma.subject.findMany({ select: { id: true, name: true, schoolId: true }, orderBy: { name: "asc" } }),
  ]);

  return { schools, cycles, classes, series, subjects };
}
