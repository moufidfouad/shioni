import type { PrismaClient } from "../../src/generated/prisma/client";
import { FinanceEntryType } from "../../src/config/prisma";
import { DEMO_SCHOOL_ID } from "./school.seed";
import type { SeededSchool } from "./school.seed";
import { seedId } from "./ids";

export interface FinanceEntryDef {
  month: number;
  type: (typeof FinanceEntryType)[keyof typeof FinanceEntryType];
  label: string;
  amount: number;
}

// `FinanceEntry` n'a pas de contrainte d'unicité en base : upsert sur un id
// dérivé de `année + mois + type + libellé` (le libellé fait partie de la
// clé pour que plusieurs écritures du même type le même mois ne se
// percutent jamais).
//
// L'année est calculée dynamiquement (`new Date().getFullYear()`) plutôt
// que codée en dur : le Tableau de bord (itération 17) et son graphique
// d'évolution mensuelle (itération 18) affichent par défaut l'année civile
// EN COURS — un seed figé sur une année passée finirait, au fil du temps,
// par alimenter une année que plus personne ne regarde par défaut.
//
// Itération 47 — `customEntries` accepte désormais un jeu d'écritures
// alternatif (par défaut : `undefined`, qui reproduit EXACTEMENT la
// génération ci-dessous, comportement inchangé pour ÉCOLE EXCELLENCE).
// `keyScope` (même principe que `personnel.seed.ts`/`timetable.seed.ts`) :
// `finance:${année}:${mois}:${type}:${libellé}` ne dépend d'aucun
// identifiant d'école — deux écoles avec un libellé identique le même mois
// (ex. "Salaires du personnel", vocabulaire générique très probable)
// produiraient sinon le même id et s'écraseraient mutuellement. Omis pour
// `DEMO_SCHOOL_ID` afin de ne pas changer les ids déjà attribués à ses
// propres écritures.
export async function seedFinances(prisma: PrismaClient, school: SeededSchool, customEntries?: FinanceEntryDef[]) {
  const year = new Date().getFullYear();
  const keyScope = school.id === DEMO_SCHOOL_ID ? "" : `${school.id}:`;

  let monthlyEntries: FinanceEntryDef[];
  if (customEntries) {
    monthlyEntries = customEntries;
  } else {
    monthlyEntries = [];
    for (let month = 1; month <= 8; month += 1) {
      monthlyEntries.push({ month, type: FinanceEntryType.RECETTE, label: "Frais de scolarité perçus", amount: 3000000 + month * 50000 });
      monthlyEntries.push({ month, type: FinanceEntryType.CHARGE, label: "Salaires du personnel", amount: 1800000 });
      monthlyEntries.push({ month, type: FinanceEntryType.CHARGE, label: "Loyer & charges locatives", amount: 250000 });
    }
    // Écritures ponctuelles, en plus des lignes récurrentes ci-dessus.
    // Itération 24 : "Subvention de l'État" remplacée par un don de la
    // diaspora — les subventions publiques directes à une école privée sont
    // rares aux Comores, alors que les transferts de la diaspora comorienne
    // (en particulier depuis la France) sont une source de financement bien
    // réelle pour les établissements scolaires et associations locales.
    monthlyEntries.push({ month: 1, type: FinanceEntryType.RECETTE, label: "Don de l'association des parents (diaspora)", amount: 500000 });
    monthlyEntries.push({ month: 5, type: FinanceEntryType.CHARGE, label: "Fournitures scolaires", amount: 350000 });
  }

  for (const entry of monthlyEntries) {
    const id = seedId(`${keyScope}finance:${year}:${entry.month}:${entry.type}:${entry.label}`);
    await prisma.financeEntry.upsert({
      where: { id },
      update: { amount: entry.amount },
      create: {
        id,
        schoolId: school.id,
        type: entry.type,
        label: entry.label,
        month: entry.month,
        year,
        amount: entry.amount,
      },
    });
  }
}
