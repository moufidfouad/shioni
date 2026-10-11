import { z } from "zod";


export const testimonialSchema = z.object({
  id: z.string().uuid().optional(),
  authorName: z.string().trim().min(2, "2 caractères minimum").max(200),
  authorRole: z.string().trim().min(2, "2 caractères minimum").max(200),
  content: z.string().trim().min(10, "10 caractères minimum").max(1000),
  published: z.boolean().optional(),
  order: z.number().int().optional(),
});

export type TestimonialInput = z.infer<typeof testimonialSchema>;
