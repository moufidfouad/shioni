import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SeededSchool } from "./school.seed";

// Itération 35 — restructuration pédagogique demandée par l'utilisateur :
// Cycle (Primaire/Collège/Lycée) -> Classe (ex "6ème", "Seconde") -> Série
// (optionnelle, ex "L"/"G"/"S") -> Groupe (section concrète affectée aux
// élèves, ex "A"/"B" — l'ancien `ClassRoom`), + Salle (local physique,
// entité indépendante). Remplace l'ancien `classRooms.seed.ts` (une seule
// table `Groupe` avec un `levelName` texte libre) : un seul fichier de seed
// pour toute la "structure pédagogique", même convention que
// `parameters.seed.ts` qui regroupe déjà `SchoolParameters` + `FeeLevel`
// (plusieurs modèles d'un même domaine dans un seul fichier, pas un fichier
// par modèle).
//
// Idempotence : `Cycle`/`Classe`/`Salle` ont une vraie contrainte
// `@@unique([schoolId, name])`, `Serie` a `@@unique([classeId, name])` — les
// trois s'upsertent directement dessus. `Groupe`, lui, N'A PAS de contrainte
// d'unicité en base sur `(classeId, serieId, name)` (voir le commentaire du
// modèle dans schema.prisma : Postgres traite deux NULL comme distincts, une
// contrainte composée incluant `serieId` ne bloquerait donc pas un doublon
// sur les classes sans série) — ce seed retrouve donc la ligne existante à
// la main (`findFirst`) avant de choisir `update`/`create`, exactement comme
// le service applicatif (`parameters.service.ts::assertGroupeNameAvailable`).

export interface SeededGroupe {
  id: string;
  name: string; // libellé composé, ex "4ème A"
  classeName: string; // ex "4ème" — pour les lookups FeeLevel en aval (enrollments/tuitionFees)
}

export interface SeededSalle {
  id: string;
  name: string;
}

// Itération 47 — types exportés (jusque-là internes à ce fichier) : les
// nouvelles écoles ajoutées par `seed.ts` définissent leur PROPRE hiérarchie
// Cycle/Classe/Série/Groupe, plus modeste que celle d'ÉCOLE EXCELLENCE, en
// s'appuyant sur ces mêmes types plutôt qu'une structure ad hoc.
export interface GroupeDef {
  letter: string; // "A", "B", ...
  targetSize?: number;
}

export interface SerieDef {
  name: string;
  order: number;
  groupes?: GroupeDef[];
}

export interface ClasseDef {
  name: string;
  order: number;
  series?: SerieDef[];
  groupes?: GroupeDef[]; // groupes directement sur la classe (classe SANS série)
}

export interface CycleDef {
  name: string;
  order: number;
  classes: ClasseDef[];
}

export interface SalleDef {
  name: string;
  capacity: number;
  type: string;
}

// Démonstration volontairement modeste au collège : on ne réutilise QUE les
// 6 élèves de démo déjà existants (`students.seed.ts`), en scindant "4ème"
// en deux groupes (A pour YOUSSOUF, B pour ABDOU) pour illustrer
// LITTÉRALEMENT l'exemple donné par l'utilisateur ("4ème -> groupe A, groupe
// B, groupe C"), plutôt que d'inventer de nouveaux élèves. "3ème" reste
// volontairement SANS groupe (démontre l'état "classe pas encore
// subdivisée", déjà celui d'aujourd'hui).
//
// Itération 38 — demande utilisateur : "AJOUTER des seeds pour plusieurs
// classes groupes et séries avec frais d'inscription et tranches d'écolage".
// Le Lycée (Seconde L/G, Première L/S, Terminale S) n'avait jusqu'ici QUE la
// configuration classes+séries, sans le moindre groupe ni élève — donc
// aucune inscription (`Enrollment`) ni tranche d'écolage (`TuitionFee`)
// alors même que `FeeLevel` y est déjà configuré pour les 3 classes
// (`parameters.seed.ts`). On ajoute désormais un groupe par série (deux pour
// "Seconde G", pour montrer aussi la pluralité de groupes AU SEIN d'une
// série) et un élève de démo par nouveau groupe dans `students.seed.ts` :
// les frais d'inscription et tranches d'écolage en découlent automatiquement
// via `enrollments.seed.ts`/`tuitionFees.seed.ts`, qui itèrent déjà
// génériquement sur tous les élèves sans liste figée.
const CYCLES: CycleDef[] = [
  {
    name: "Primaire",
    order: 0,
    classes: [
      { name: "CP/CE1", order: 0 },
      { name: "CM2", order: 1 },
    ],
  },
  {
    name: "Collège",
    order: 1,
    classes: [
      { name: "6ème", order: 0, groupes: [{ letter: "A", targetSize: 35 }] },
      { name: "5ème", order: 1, groupes: [{ letter: "A", targetSize: 33 }] },
      {
        name: "4ème",
        order: 2,
        groupes: [
          { letter: "A", targetSize: 15 },
          { letter: "B", targetSize: 15 },
        ],
      },
      { name: "3ème", order: 3 },
    ],
  },
  {
    name: "Lycée",
    order: 2,
    classes: [
      {
        name: "Seconde",
        order: 0,
        series: [
          { name: "L", order: 0, groupes: [{ letter: "A", targetSize: 25 }] },
          {
            name: "G",
            order: 1,
            groupes: [
              { letter: "A", targetSize: 28 },
              { letter: "B", targetSize: 22 },
            ],
          },
        ],
      },
      {
        name: "Première",
        order: 1,
        series: [
          { name: "L", order: 0, groupes: [{ letter: "A", targetSize: 20 }] },
          { name: "S", order: 1, groupes: [{ letter: "A", targetSize: 30 }] },
        ],
      },
      {
        name: "Terminale",
        order: 2,
        series: [{ name: "S", order: 0, groupes: [{ letter: "A", targetSize: 24 }] }],
      },
    ],
  },
];

const SALLES: SalleDef[] = [
  { name: "Salle 1", capacity: 40, type: "Standard" },
  { name: "Salle 2", capacity: 35, type: "Standard" },
  { name: "Salle 3", capacity: 30, type: "Standard" },
  { name: "Salle 4", capacity: 20, type: "Standard" },
  { name: "Labo Sciences", capacity: 24, type: "Laboratoire" },
  { name: "Salle Informatique", capacity: 20, type: "Informatique" },
];

export interface SeededStructure {
  classeIdByName: Map<string, string>;
  groupes: Map<string, SeededGroupe>;
  salles: Map<string, SeededSalle>;
}

async function upsertGroupe(
  prisma: PrismaClient,
  school: SeededSchool,
  classeId: string,
  serieId: string | null,
  g: GroupeDef,
  classeName: string,
  // Itération 38 — nom de la série (null si la classe n'a pas de série), pour
  // composer une clé de map sans collision : sans ce paramètre, deux séries
  // d'une même classe partageant une même lettre de groupe (ex "Seconde L
  // A" et "Seconde G A") produiraient toutes les deux la clé "Seconde A" et
  // s'écraseraient silencieusement l'une l'autre. Même formule de composition
  // que le front (`groupeLabel.ts`, itération 37) : "<classe>[ <série>] <lettre>".
  serieName: string | null,
  groupes: Map<string, SeededGroupe>
) {
  const existing = await prisma.groupe.findFirst({
    where: { schoolId: school.id, classeId, serieId, name: g.letter },
  });
  const groupe = existing
    ? await prisma.groupe.update({ where: { id: existing.id }, data: { targetSize: g.targetSize } })
    : await prisma.groupe.create({
        data: {
          schoolId: school.id,
          classeId,
          serieId: serieId ?? undefined,
          name: g.letter,
          targetSize: g.targetSize,
        },
      });

  const label = `${classeName}${serieName ? ` ${serieName}` : ""} ${g.letter}`;
  groupes.set(label, { id: groupe.id, name: label, classeName });
}

// Itération 47 — `cycles`/`salles` acceptent désormais un troisième et
// quatrième paramètre optionnel (par défaut : la structure d'ÉCOLE
// EXCELLENCE ci-dessus, comportement STRICTEMENT inchangé pour cette école)
// afin qu'une nouvelle école puisse fournir sa propre hiérarchie, plus
// modeste, sans dupliquer la logique d'upsert ci-dessous.
export async function seedStructure(
  prisma: PrismaClient,
  school: SeededSchool,
  cycles: CycleDef[] = CYCLES,
  salleDefs: SalleDef[] = SALLES
): Promise<SeededStructure> {
  const classeIdByName = new Map<string, string>();
  const groupes = new Map<string, SeededGroupe>();

  for (const cycleDef of cycles) {
    const cycle = await prisma.cycle.upsert({
      where: { schoolId_name: { schoolId: school.id, name: cycleDef.name } },
      update: { order: cycleDef.order },
      create: { schoolId: school.id, name: cycleDef.name, order: cycleDef.order },
    });

    for (const classeDef of cycleDef.classes) {
      const classe = await prisma.classe.upsert({
        where: { schoolId_name: { schoolId: school.id, name: classeDef.name } },
        update: { cycleId: cycle.id, order: classeDef.order },
        create: { schoolId: school.id, cycleId: cycle.id, name: classeDef.name, order: classeDef.order },
      });
      classeIdByName.set(classeDef.name, classe.id);

      for (const g of classeDef.groupes ?? []) {
        await upsertGroupe(prisma, school, classe.id, null, g, classeDef.name, null, groupes);
      }

      for (const serieDef of classeDef.series ?? []) {
        const serie = await prisma.serie.upsert({
          where: { classeId_name: { classeId: classe.id, name: serieDef.name } },
          update: { order: serieDef.order },
          create: { schoolId: school.id, classeId: classe.id, name: serieDef.name, order: serieDef.order },
        });

        for (const g of serieDef.groupes ?? []) {
          await upsertGroupe(prisma, school, classe.id, serie.id, g, classeDef.name, serieDef.name, groupes);
        }
      }
    }
  }

  const salles = new Map<string, SeededSalle>();
  for (const s of salleDefs) {
    const salle = await prisma.salle.upsert({
      where: { schoolId_name: { schoolId: school.id, name: s.name } },
      update: { capacity: s.capacity, type: s.type },
      create: { schoolId: school.id, name: s.name, capacity: s.capacity, type: s.type },
    });
    salles.set(s.name, { id: salle.id, name: s.name });
  }

  return { classeIdByName, groupes, salles };
}
