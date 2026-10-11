import { prisma } from "../config/prisma";

export interface StructureFilter {
  cycleId?: string;
  classeId?: string;
  serieId?: string;
  groupeId?: string;
}

export async function resolveGroupeIds(
  schoolId: string,
  filter: StructureFilter,
): Promise<string[] | undefined> {
  if (
    !filter.cycleId &&
    !filter.classeId &&
    !filter.serieId &&
    !filter.groupeId
  )
    return undefined;
  if (filter.groupeId) return [filter.groupeId];

  const where: {
    schoolId: string;
    serieId?: string;
    classeId?: string;
    classe?: { cycleId: string };
  } = { schoolId };
  if (filter.serieId) where.serieId = filter.serieId;
  else if (filter.classeId) where.classeId = filter.classeId;
  else if (filter.cycleId) where.classe = { cycleId: filter.cycleId };

  const groupes = await prisma.groupe.findMany({ where, select: { id: true } });
  return groupes.map((g) => g.id);
}

export function intersectGroupeIds(
  a: string[] | undefined,
  b: string[] | undefined,
): string[] | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  const bSet = new Set(b);
  return a.filter((id) => bSet.has(id));
}
