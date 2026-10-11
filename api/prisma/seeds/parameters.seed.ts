import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SeededSchool } from "./school.seed";

// Feuille "PARAMETRES" : réglages pédagogiques (barème, seuils de mention)
// + grille des frais par niveau. `SchoolParameters` est upserté par
// `schoolId` (`@unique`) — déjà idempotent sans `seedId()`.
// Itération 35 — `FeeLevel` référence désormais une `Classe` par FK
// (`classeId`, `@unique` — voir schema.prisma), plus un `levelName` texte
// libre : ce fichier reçoit donc `classeIdByName`, construit par
// `structure.seed.ts`, qui doit impérativement tourner AVANT celui-ci
// (inversion volontaire de l'ordre historique — voir seed.ts). Intitulés
// alignés EXACTEMENT sur ceux des `Classe` de `structure.seed.ts`
// ("2nde"/"1ère"/"Primaire — CP/CE1"/"Primaire — CM2" renommés en
// "Seconde"/"Première"/"CP/CE1"/"CM2").
// Itération 34 — 3ème colonne : tarif MENSUEL d'écolage suggéré pour ce
// niveau (`FeeLevel.monthlyAmount`, distinct du droit d'inscription annuel
// des colonnes précédentes). Ordre de grandeur illustratif pour la démo
// (grossièrement un dixième du montant annuel, pas un vrai barème
// communiqué par l'utilisateur) — un jugement de démonstration, à ajuster
// librement par chaque école via SchoolSettingsPage.
const FEE_LEVELS: [string, number, number][] = [
  ["6ème", 150000, 15000],
  ["5ème", 155000, 15500],
  ["4ème", 160000, 16000],
  ["3ème", 165000, 16500],
  ["Seconde", 180000, 18000],
  ["Première", 185000, 18500],
  ["Terminale", 190000, 19000],
  ["CP/CE1", 80000, 8000],
  ["CM2", 90000, 9000],
];

export interface FeeLevelAmounts {
  amount: number;
  monthlyAmount: number;
}

// Itération 47 — `feeLevels` accepte désormais un troisième paramètre
// optionnel (par défaut : le barème d'ÉCOLE EXCELLENCE ci-dessus,
// comportement inchangé pour cette école). Une nouvelle école, dont la
// hiérarchie ne couvre qu'un sous-ensemble de ces classes (ex. seulement
// "6ème"/"5ème"), doit fournir explicitement SON PROPRE sous-ensemble —
// jamais la liste complète, qui ferait échouer le lookup `classeIdByName`
// ci-dessous sur une classe qu'elle n'a pas.
export async function seedParameters(
  prisma: PrismaClient,
  school: SeededSchool,
  classeIdByName: Map<string, string>,
  feeLevels: [string, number, number][] = FEE_LEVELS
): Promise<Map<string, FeeLevelAmounts>> {
  await prisma.schoolParameters.upsert({
    where: { schoolId: school.id },
    update: {},
    create: {
      schoolId: school.id,
      noteMax: 20,
      notePassage: 10,
      nbTrimestres: 3,
      trimestreEnCours: 2,
      nbHeuresSemaine: 30,
      seuilBien: 14,
      seuilTresBien: 16,
      seuilExcellent: 18,
    },
  });

  const feeLevelAmounts = new Map<string, FeeLevelAmounts>();
  for (const [classeName, amount, monthlyAmount] of feeLevels) {
    const classeId = classeIdByName.get(classeName);
    if (!classeId) throw new Error(`Classe inconnue dans le seed frais scolaires : "${classeName}"`);

    await prisma.feeLevel.upsert({
      where: { classeId },
      update: { amount, monthlyAmount },
      create: { schoolId: school.id, classeId, amount, monthlyAmount },
    });
    feeLevelAmounts.set(classeName, { amount, monthlyAmount });
  }

  return feeLevelAmounts;
}
