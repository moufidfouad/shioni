import { prisma } from "../../config/prisma";


export async function listPublishedTestimonials() {
  return prisma.testimonial.findMany({
    where: { published: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      authorName: true,
      authorRole: true,
      content: true,
    },
  });
}
