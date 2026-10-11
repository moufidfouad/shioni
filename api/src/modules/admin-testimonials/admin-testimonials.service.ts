import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import type { TestimonialInput } from "./admin-testimonials.schema";

// Vue ADMIN : tous les témoignages, publiés ou non 
export async function listAllTestimonials() {
  return prisma.testimonial.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

export async function upsertTestimonial(input: TestimonialInput) {
  const { id, ...data } = input;

  if (id) {
    const existing = await prisma.testimonial.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound("Témoignage introuvable.");
    return prisma.testimonial.update({ where: { id }, data });
  }

  return prisma.testimonial.create({
    data: {
      authorName: data.authorName,
      authorRole: data.authorRole,
      content: data.content,
      published: data.published ?? true,
      order: data.order ?? 0,
    },
  });
}

export async function deleteTestimonial(id: string) {
  const existing = await prisma.testimonial.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Témoignage introuvable.");
  await prisma.testimonial.delete({ where: { id } });
}
