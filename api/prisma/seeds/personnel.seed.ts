import type { PrismaClient } from "../../src/generated/prisma/client";
import { DEMO_SCHOOL_ID } from "./school.seed";
import type { SeededSchool } from "./school.seed";
import { seedId } from "./ids";

export interface SeededStaff {
  id: string;
  fullName: string;
}

// Itération 47 — type exporté (jusque-là un littéral anonyme), pour que les
// nouvelles écoles définissent leur propre effectif de démo.
export interface StaffDef {
  slug: string;
  fullName: string;
  specialite: string;
  fonction: string;
  diplome: string;
  typeContrat: string;
  salaireBrut: number;
  heuresSemaine: number;
}

// `StaffMember` n'a AUCUNE contrainte d'unicité en base (choix documenté du
// schéma — voir `ids.ts`) : chaque fiche est upsertée sur un id dérivé de
// façon stable de son nom complet (`seedId("staff:...")`), jamais créée à
// l'aveugle.
//
// Itération 24 — noms et diplômes relocalisés aux Comores : les diplômes
// "CAPES"/"DIPES" (concours d'enseignement camerounais) n'existent pas dans
// le système éducatif comorien, remplacés par les intitulés réellement
// délivrés par l'Université des Comores (UDC, Moroni, seule université du
// pays) ou par l'ancienne École Normale des Instituteurs pour les
// enseignants plus anciens.
const STAFF: StaffDef[] = [
  {
    slug: "said-abdou",
    fullName: "M. ABDOU Saïd",
    specialite: "Mathématiques",
    fonction: "Enseignant",
    diplome: "Licence en Mathématiques — Université des Comores",
    typeContrat: "CDI",
    salaireBrut: 220000,
    heuresSemaine: 18,
  },
  {
    slug: "fatima-mohamed",
    fullName: "Mme MOHAMED Fatima",
    specialite: "Français",
    fonction: "Enseignante",
    diplome: "Maîtrise de Lettres Modernes — Université des Comores",
    typeContrat: "CDI",
    salaireBrut: 200000,
    heuresSemaine: 18,
  },
  {
    slug: "ibrahim-soilihi",
    fullName: "M. SOILIHI Ibrahim",
    specialite: "Anglais",
    fonction: "Enseignant",
    diplome: "Licence d'Anglais — Université des Comores",
    typeContrat: "CDD",
    salaireBrut: 180000,
    heuresSemaine: 16,
  },
  {
    slug: "halima-bacar",
    fullName: "Mme BACAR Halima",
    specialite: "SVT",
    fonction: "Enseignante",
    diplome: "Licence de Sciences de la Vie et de la Terre — Université des Comores",
    typeContrat: "CDI",
    salaireBrut: 190000,
    heuresSemaine: 17,
  },
  {
    slug: "toihir-hassane",
    fullName: "M. HASSANE Toihir",
    specialite: "Histoire-Géographie",
    fonction: "Enseignant",
    diplome: "Diplôme de l'École Normale — Histoire-Géographie",
    typeContrat: "Vacataire",
    salaireBrut: 90000,
    heuresSemaine: 10,
  },
];

// Itération 47 — `staffDefs` accepte désormais un second paramètre optionnel
// (par défaut : les 5 membres du personnel d'ÉCOLE EXCELLENCE ci-dessus).
// `keyScope` corrige au passage un risque de collision d'id RÉEL pour toute
// nouvelle école : `seedId(\`staff:${slug}\`)` ne dépendait jusqu'ici que du
// slug, jamais de l'école — deux écoles ne pouvaient exister avant cette
// itération, donc ça n'avait jamais posé problème, mais une nouvelle école
// réutilisant (ou non) un slug produirait sinon un id STABLE identique à
// celui d'ÉCOLE EXCELLENCE, l'upsert `update`-erait alors la fiche de la
// MAUVAISE école (elle ne réattribue jamais `schoolId`) au lieu d'en créer
// une nouvelle. Le préfixe est OMIS pour `DEMO_SCHOOL_ID` (ÉCOLE EXCELLENCE)
// afin de ne PAS changer les ids déjà attribués à ses 5 fiches Personnel —
// principe déjà établi pour tout id de seed déjà livré (voir `DEMO_SCHOOL_ID`
// lui-même, jamais un `seedId()` dérivé, pour la même raison).
export async function seedPersonnel(
  prisma: PrismaClient,
  school: SeededSchool,
  staffDefs: StaffDef[] = STAFF
): Promise<Map<string, SeededStaff>> {
  const staff = new Map<string, SeededStaff>();
  const keyScope = school.id === DEMO_SCHOOL_ID ? "" : `${school.id}:`;

  for (const s of staffDefs) {
    const id = seedId(`${keyScope}staff:${s.slug}`);
    await prisma.staffMember.upsert({
      where: { id },
      update: {
        specialite: s.specialite,
        fonction: s.fonction,
        diplome: s.diplome,
        typeContrat: s.typeContrat,
        salaireBrut: s.salaireBrut,
        heuresSemaine: s.heuresSemaine,
      },
      create: {
        id,
        schoolId: school.id,
        fullName: s.fullName,
        specialite: s.specialite,
        fonction: s.fonction,
        diplome: s.diplome,
        typeContrat: s.typeContrat,
        salaireBrut: s.salaireBrut,
        heuresSemaine: s.heuresSemaine,
        statut: "Actif",
      },
    });
    staff.set(s.slug, { id, fullName: s.fullName });
  }

  return staff;
}
