import type { PrismaClient } from "../../src/generated/prisma/client";
import { seedId } from "./ids";

interface TestimonialSeed {
  key: string;
  authorName: string;
  authorRole: string;
  content: string;
  order: number;
}

const TESTIMONIALS: TestimonialSeed[] = [
  {
    key: "testimonial:abdou-said",
    authorName: "M. ABDOU Saïd",
    authorRole: "Directeur, École Excellence",
    content:
      "Avant SHIONI, chaque trimestre je passais des journées entières à rassembler les notes de chaque professeur pour sortir les bulletins. Aujourd'hui les moyennes se calculent toutes seules et je peux suivre les paiements d'écolage sans attendre le rapport de la comptabilité.",
    order: 0,
  },
  {
    key: "testimonial:chouzour-fatima",
    authorName: "Mme CHOUZOUR Fatima",
    authorRole: "Directrice, Collège Al-Camar",
    content:
      "La messagerie a changé notre façon de communiquer avec les parents : plus besoin de faire circuler un cahier de liaison entre les classes, un message groupé suffit et je vois qui l'a lu.",
    order: 1,
  },
  {
    key: "testimonial:attoumani-housni",
    authorName: "M. ATTOUMANI Housni",
    authorRole: "Directeur, Lycée de Mwali",
    content:
      "Gérer un lycée avec plusieurs séries n'est pas simple, mais les tableaux d'analyse par cycle, classe et série me donnent enfin une vue d'ensemble claire, salle par salle, sans avoir à tout recompter à la main.",
    order: 2,
  },
  {
    key: "testimonial:djamal-nour",
    authorName: "M. DJAMAL Nour",
    authorRole: "Enseignant de mathématiques, Collège Al-Camar",
    content:
      "Je saisis mes notes en salle des professeurs entre deux cours, sur mon téléphone, et les parents peuvent suivre la progression de leur enfant sans attendre la remise des bulletins.",
    order: 3,
  },
  {
    key: "testimonial:ali-halima",
    authorName: "Mme ALI Halima",
    authorRole: "Enseignante de français, Collège Al-Camar",
    content:
      "Le suivi des présences classe par classe prend quelques secondes en début de cours — un vrai changement comparé au registre papier qu'il fallait ensuite recopier.",
    order: 4,
  },
];

export async function seedTestimonials(prisma: PrismaClient): Promise<number> {
  for (const t of TESTIMONIALS) {
    await prisma.testimonial.upsert({
      where: { id: seedId(t.key) },
      update: {
        authorName: t.authorName,
        authorRole: t.authorRole,
        content: t.content,
        order: t.order,
        published: true,
      },
      create: {
        id: seedId(t.key),
        authorName: t.authorName,
        authorRole: t.authorRole,
        content: t.content,
        order: t.order,
        published: true,
      },
    });
  }
  return TESTIMONIALS.length;
}
