import { prisma, FinanceEntryType } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { buildPaginationMeta, PaginationQuery, toSkipTake } from "../../utils/pagination";
import type { FinanceEntryInput, UpdateFinanceEntryInput } from "./finance.schema";

export interface FinanceFilters {
  year?: number;
  month?: number;
  type?: FinanceEntryType;
}

export async function listFinanceEntries(schoolId: string, opts: FinanceFilters, pagination: PaginationQuery) {
  // `where` extrait dans une variable locale, réutilisée à l'identique par
  // le `findMany` (page courante) et le `count` (total) ci-dessous.
  const where = {
    schoolId,
    year: opts.year || undefined,
    month: opts.month || undefined,
    type: opts.type || undefined,
  };

  const [entries, total] = await Promise.all([
    prisma.financeEntry.findMany({
      where,
      orderBy: [{ year: "desc" }, { month: "desc" }, { label: "asc" }],
      ...toSkipTake(pagination),
    }),
    prisma.financeEntry.count({ where }),
  ]);

  return { data: entries, pagination: buildPaginationMeta(total, pagination) };
}

// Cartes de stats équivalentes à l'en-tête de la feuille "FINANCES" : total
// recettes/charges/solde, filtrable par année (et éventuellement mois) —
// même patron que `enrollments.service.ts::getEnrollmentStats`.
export async function getFinanceStats(schoolId: string, year?: number, month?: number) {
  const entries = await prisma.financeEntry.findMany({
    where: { schoolId, year: year || undefined, month: month || undefined },
    select: { type: true, amount: true },
  });
  const totalRecettes = entries
    .filter((e) => e.type === FinanceEntryType.RECETTE)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCharges = entries
    .filter((e) => e.type === FinanceEntryType.CHARGE)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return { count: entries.length, totalRecettes, totalCharges, solde: totalRecettes - totalCharges };
}

// Évolution mensuelle (12 points, un par mois de l'année demandée), pour le
// graphique du Tableau de bord (itération 18) : recettes/charges/solde par
// mois, y compris les mois sans aucune écriture (à 0) — le frontend a besoin
// d'un point par mois, pas seulement des mois renseignés.
export async function getMonthlyFinanceSummary(schoolId: string, year: number) {
  const entries = await prisma.financeEntry.findMany({
    where: { schoolId, year },
    select: { type: true, month: true, amount: true },
  });

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthEntries = entries.filter((e) => e.month === month);
    const totalRecettes = monthEntries
      .filter((e) => e.type === FinanceEntryType.RECETTE)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const totalCharges = monthEntries
      .filter((e) => e.type === FinanceEntryType.CHARGE)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    return { month, totalRecettes, totalCharges, solde: totalRecettes - totalCharges };
  });
}

export async function getFinanceEntry(schoolId: string, id: string) {
  const entry = await prisma.financeEntry.findFirst({ where: { id, schoolId } });
  if (!entry) throw ApiError.notFound("Écriture financière introuvable.");
  return entry;
}

export async function createFinanceEntry(schoolId: string, input: FinanceEntryInput) {
  return prisma.financeEntry.create({ data: { schoolId, ...input } });
}

export async function updateFinanceEntry(schoolId: string, id: string, input: UpdateFinanceEntryInput) {
  await getFinanceEntry(schoolId, id);
  return prisma.financeEntry.update({ where: { id }, data: input });
}

export async function deleteFinanceEntry(schoolId: string, id: string) {
  await getFinanceEntry(schoolId, id);
  await prisma.financeEntry.delete({ where: { id } });
}
