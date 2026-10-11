import fs from "fs";
import path from "path";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { ResourceType } from "../../src/config/prisma";
import { env } from "../../src/config/env";
import { seedId } from "./ids";
import type { SeededSchool } from "./school.seed";
import type { SeededSubject } from "./subjects.seed";



export interface ResourceSchoolContext {
  school: SeededSchool;
  publishedByUserId: string;
  subjects: Map<string, SeededSubject>;
  classeIdByName: Map<string, string>;
}

interface DocumentTemplate {
  key: string;
  title: string;
  description: string;
  type: "DOCUMENT";
  documentBody: string;
  classNames: string[];
  published?: boolean;
}

interface VideoTemplate {
  key: string;
  title: string;
  description: string;
  type: "VIDEO";
  videoUrl: string;
  classNames: string[];
  published?: boolean;
}

type ResourceTemplate = DocumentTemplate | VideoTemplate;

// Trois courts métrages libres de droits (licence Creative Commons,
// Blender Institute/Blender Foundation) — voir commentaire d'en-tête.
const VIDEO_URLS = {
  bigBuckBunny: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
  sintel: "https://www.youtube.com/watch?v=eRsGyueVLvQ",
  tearsOfSteel: "https://www.youtube.com/watch?v=R6MlUcmOul8",
};

function doc(resume: string): string {
  return `Document de démonstration (jeu de données de seed).\n\n${resume}\n`;
}

// Une seule matière ("Annales Terminale") marquée `published: false` —
// Mathématiques — pour démontrer concrètement le statut "brouillon" (voir
// `Resource.published`, schema.prisma) : visible dans la page de gestion de
// l'école, absente de la page publique.
const SUBJECT_TEMPLATES: Record<string, ResourceTemplate[]> = {
  "Mathématiques": [
    {
      key: "fiche-fractions",
      title: "Fiche de cours — Les fractions",
      description: "Rappels de cours (addition, soustraction, simplification) et exercices corrigés sur les fractions.",
      type: "DOCUMENT",
      documentBody: doc("Définitions, propriétés, exemples et 10 exercices corrigés sur les fractions."),
      classNames: ["6ème", "5ème"],
    },
    {
      key: "exercices-equations",
      title: "Exercices corrigés — Équations du premier degré",
      description: "Série de 15 équations du premier degré à une inconnue, avec corrigé détaillé.",
      type: "DOCUMENT",
      documentBody: doc("15 équations progressives, méthode de résolution pas à pas, corrigé complet."),
      classNames: ["4ème", "3ème"],
    },
    {
      key: "annales-bac",
      title: "Annales — Sujets de mathématiques Terminale",
      description: "Sélection de sujets d'examen des sessions précédentes, avec barème — en cours de relecture.",
      type: "DOCUMENT",
      documentBody: doc("3 sujets complets (fonctions, probabilités, suites), barème de correction officiel."),
      classNames: ["Terminale"],
      published: false,
    },
    {
      key: "video-geometrie-espace",
      title: "Vidéo — Introduction à la géométrie dans l'espace",
      description: "Support vidéo introductif sur les solides usuels (cube, pyramide, cylindre, sphère).",
      type: "VIDEO",
      videoUrl: VIDEO_URLS.bigBuckBunny,
      classNames: ["5ème", "Seconde"],
    },
    {
      key: "video-probabilites",
      title: "Vidéo — Les probabilités expliquées simplement",
      description: "Support vidéo sur les notions de base des probabilités (expérience aléatoire, issue, événement).",
      type: "VIDEO",
      videoUrl: VIDEO_URLS.sintel,
      classNames: ["Première", "Terminale"],
    },
  ],
  "Français": [
    {
      key: "fiche-lecture-petit-prince",
      title: "Fiche de lecture — Le Petit Prince",
      description: "Résumé par chapitre, personnages principaux et thèmes clés d'Antoine de Saint-Exupéry.",
      type: "DOCUMENT",
      documentBody: doc("Résumé par chapitre, fiche personnages, citations à retenir."),
      classNames: ["CM2", "6ème"],
    },
    {
      key: "exercices-passe-compose",
      title: "Exercices corrigés — La conjugaison du passé composé",
      description: "20 phrases à conjuguer au passé composé, avec corrigé et rappel des règles d'accord.",
      type: "DOCUMENT",
      documentBody: doc("20 phrases à conjuguer, rappel des règles d'accord du participe passé, corrigé."),
      classNames: ["5ème", "4ème"],
    },
    {
      key: "annales-francais",
      title: "Annales — Sujets de français Terminale (dissertation)",
      description: "Sujets de dissertation des sessions précédentes, avec plans détaillés.",
      type: "DOCUMENT",
      documentBody: doc("3 sujets de dissertation, plans détaillés, conseils méthodologiques."),
      classNames: ["Terminale"],
    },
    {
      key: "video-figures-de-style",
      title: "Vidéo — Les figures de style expliquées",
      description: "Support vidéo sur la métaphore, la comparaison, l'antithèse et l'hyperbole.",
      type: "VIDEO",
      videoUrl: VIDEO_URLS.tearsOfSteel,
      classNames: ["4ème", "Première"],
    },
    {
      key: "video-commentaire-texte",
      title: "Vidéo — Méthodologie du commentaire de texte",
      description: "Support vidéo sur la construction d'un commentaire de texte structuré.",
      type: "VIDEO",
      videoUrl: VIDEO_URLS.bigBuckBunny,
      classNames: ["Première", "Terminale"],
    },
  ],
  "Anglais": [
    {
      key: "fiche-se-presenter",
      title: "Fiche de vocabulaire — Se présenter en anglais",
      description: "Vocabulaire et structures de base pour se présenter (nom, âge, famille, loisirs).",
      type: "DOCUMENT",
      documentBody: doc("Liste de vocabulaire, structures types, dialogue d'exemple."),
      classNames: ["6ème", "5ème"],
    },
    {
      key: "exercices-present-perfect",
      title: "Exercices corrigés — Le present perfect",
      description: "15 phrases à compléter au present perfect, avec corrigé et rappel de la règle de formation.",
      type: "DOCUMENT",
      documentBody: doc("15 phrases à compléter, rappel de règle, corrigé."),
      classNames: ["4ème", "Seconde"],
    },
    {
      key: "annales-anglais",
      title: "Annales — Sujets d'anglais Terminale (compréhension écrite)",
      description: "Textes et questions de compréhension écrite des sessions précédentes, avec corrigé.",
      type: "DOCUMENT",
      documentBody: doc("2 textes authentiques, questions de compréhension, corrigé détaillé."),
      classNames: ["Terminale"],
    },
    {
      key: "video-prononciation",
      title: "Vidéo — Prononciation : les sons difficiles de l'anglais",
      description: "Support vidéo sur les sons anglais sans équivalent en français (th, r, voyelles longues/courtes).",
      type: "VIDEO",
      videoUrl: VIDEO_URLS.sintel,
      classNames: ["6ème", "Seconde"],
    },
    {
      key: "video-oral-anglais",
      title: "Vidéo — Préparer un oral d'anglais",
      description: "Support vidéo méthodologique pour structurer un exposé oral en anglais.",
      type: "VIDEO",
      videoUrl: VIDEO_URLS.tearsOfSteel,
      classNames: ["Première", "Terminale"],
    },
  ],
  "SVT": [
    {
      key: "fiche-reproduction-humaine",
      title: "Fiche de cours — La reproduction humaine",
      description: "Schémas annotés et vocabulaire clé sur l'appareil reproducteur et la fécondation.",
      type: "DOCUMENT",
      documentBody: doc("Schémas annotés, vocabulaire clé, questions de révision."),
      classNames: ["4ème"],
    },
    {
      key: "exercices-digestion",
      title: "Exercices corrigés — La digestion et l'absorption des nutriments",
      description: "Questions à réponse courte sur le trajet des aliments et l'absorption intestinale, avec corrigé.",
      type: "DOCUMENT",
      documentBody: doc("Questions à réponse courte, schéma du système digestif, corrigé."),
      classNames: ["5ème"],
    },
    {
      key: "annales-svt",
      title: "Annales — Sujets de SVT Terminale (génétique)",
      description: "Sujets de génétique des sessions précédentes, avec corrigé détaillé.",
      type: "DOCUMENT",
      documentBody: doc("2 sujets de génétique, corrigé détaillé, rappels de cours associés."),
      classNames: ["Terminale"],
    },
    {
      key: "video-cycle-eau",
      title: "Vidéo — Le cycle de l'eau expliqué",
      description: "Support vidéo sur l'évaporation, la condensation et les précipitations.",
      type: "VIDEO",
      videoUrl: VIDEO_URLS.bigBuckBunny,
      classNames: ["6ème", "Seconde"],
    },
    {
      key: "video-tectonique-plaques",
      title: "Vidéo — La tectonique des plaques",
      description: "Support vidéo sur la dérive des continents et les zones de risque sismique/volcanique.",
      type: "VIDEO",
      videoUrl: VIDEO_URLS.sintel,
      classNames: ["Première", "Terminale"],
    },
  ],
  "Histoire-Géographie": [
    {
      key: "fiche-grandes-decouvertes",
      title: "Fiche de cours — Les grandes découvertes",
      description: "Repères chronologiques et cartes des grandes explorations des XVe-XVIe siècles.",
      type: "DOCUMENT",
      documentBody: doc("Frise chronologique, cartes des routes maritimes, vocabulaire clé."),
      classNames: ["5ème"],
    },
    {
      key: "exercices-carte-topographique",
      title: "Exercices corrigés — Lire une carte topographique",
      description: "Exercices de repérage, d'échelle et de courbes de niveau, avec corrigé.",
      type: "DOCUMENT",
      documentBody: doc("Exercices de repérage et d'échelle, corrigé, lexique cartographique."),
      classNames: ["6ème", "4ème"],
    },
    {
      key: "annales-histoire-geo",
      title: "Annales — Sujets d'histoire-géographie Terminale (composition)",
      description: "Sujets de composition des sessions précédentes, avec plans détaillés.",
      type: "DOCUMENT",
      documentBody: doc("2 sujets de composition, plans détaillés, conseils méthodologiques."),
      classNames: ["Terminale"],
    },
    {
      key: "video-decolonisation-afrique",
      title: "Vidéo — La décolonisation en Afrique",
      description: "Support vidéo sur les grandes étapes de la décolonisation africaine (1945-1975).",
      type: "VIDEO",
      videoUrl: VIDEO_URLS.tearsOfSteel,
      classNames: ["3ème", "Première"],
    },
    {
      key: "video-mondialisation",
      title: "Vidéo — Comprendre la mondialisation",
      description: "Support vidéo sur les flux économiques, les acteurs et les débats autour de la mondialisation.",
      type: "VIDEO",
      videoUrl: VIDEO_URLS.bigBuckBunny,
      classNames: ["Première", "Terminale"],
    },
  ],
};

async function seedResourcesForSchool(prisma: PrismaClient, ctx: ResourceSchoolContext): Promise<number> {
  const uploadsDir = path.join(process.cwd(), env.RESOURCES_UPLOADS_DIR);
  fs.mkdirSync(uploadsDir, { recursive: true });

  let count = 0;

  for (const [subjectName, subject] of ctx.subjects) {
    const templates = SUBJECT_TEMPLATES[subjectName];
    if (!templates) continue; // matière sans gabarit défini — garde défensive, jamais le cas actuellement

    for (const tpl of templates) {
      const resourceId = seedId(`resource:${ctx.school.id}:${subjectName}:${tpl.key}`);

      // Voir le commentaire d'en-tête : repli sur la première classe
      // disponible de l'école si aucune des classes "typiques" du gabarit
      // n'existe ici (ex. COLLÈGE AL-CAMAR n'a pas de "Terminale").
      let classeIds = tpl.classNames
        .map((name) => ctx.classeIdByName.get(name))
        .filter((id): id is string => Boolean(id));
      if (classeIds.length === 0) {
        const fallback = ctx.classeIdByName.values().next().value;
        if (fallback) classeIds = [fallback];
      }
      if (classeIds.length === 0) continue; // école sans aucune classe — jamais le cas ici, garde défensive

      const published = tpl.published ?? true;

      if (tpl.type === "DOCUMENT") {
        // Nom de fichier dérivé de l'id (stable), voir commentaire d'en-tête
        // — écrit RÉELLEMENT sur disque pour que le téléchargement fonctionne.
        const fileName = `${resourceId}.txt`;
        fs.writeFileSync(path.join(uploadsDir, fileName), tpl.documentBody, "utf8");
        const fileSize = Buffer.byteLength(tpl.documentBody, "utf8");

        await prisma.resource.upsert({
          where: { id: resourceId },
          update: {
            title: tpl.title,
            description: tpl.description,
            published,
            fileName,
            originalName: `${tpl.key}.txt`,
            mimeType: "text/plain",
            fileSize,
            videoUrl: null,
          },
          create: {
            id: resourceId,
            schoolId: ctx.school.id,
            title: tpl.title,
            description: tpl.description,
            type: ResourceType.DOCUMENT,
            published,
            publishedById: ctx.publishedByUserId,
            fileName,
            originalName: `${tpl.key}.txt`,
            mimeType: "text/plain",
            fileSize,
          },
        });
      } else {
        await prisma.resource.upsert({
          where: { id: resourceId },
          update: {
            title: tpl.title,
            description: tpl.description,
            published,
            videoUrl: tpl.videoUrl,
            fileName: null,
            originalName: null,
            mimeType: null,
            fileSize: null,
          },
          create: {
            id: resourceId,
            schoolId: ctx.school.id,
            title: tpl.title,
            description: tpl.description,
            type: ResourceType.VIDEO,
            published,
            publishedById: ctx.publishedByUserId,
            videoUrl: tpl.videoUrl,
          },
        });
      }

      // Liaisons matière/classes recréées à l'identique (voir commentaire
      // d'en-tête — aucune contrainte d'unicité à cibler sur ces deux
      // tables de jointure, contrairement à `Resource` ci-dessus).
      await prisma.resourceSubject.deleteMany({ where: { resourceId } });
      await prisma.resourceSubject.createMany({ data: [{ resourceId, subjectId: subject.id }] });
      await prisma.resourceClasse.deleteMany({ where: { resourceId } });
      await prisma.resourceClasse.createMany({ data: classeIds.map((classeId) => ({ resourceId, classeId })) });

      count += 1;
    }
  }

  return count;
}

export async function seedResources(prisma: PrismaClient, contexts: ResourceSchoolContext[]): Promise<number> {
  let total = 0;
  for (const ctx of contexts) {
    total += await seedResourcesForSchool(prisma, ctx);
  }
  return total;
}
