import { z } from "zod";


const idArray = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  },
  z.array(z.string().uuid()).min(1, "Au moins un élément requis."),
);

// Même souci pour un booléen envoyé en multipart ("true"/"false" en texte).
const booleanish = z.preprocess((value) => {
  if (typeof value === "string") return value === "true" || value === "1";
  return value;
}, z.boolean().optional());

export const createVideoResourceSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  videoUrl: z.string().url(),
  subjectIds: idArray,
  classeIds: idArray,
  published: z.boolean().optional(),
});


export const createDocumentResourceSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  subjectIds: idArray,
  classeIds: idArray,
  published: booleanish,
});


export const updateResourceSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  published: z.boolean().optional(),
  videoUrl: z.string().url().optional(),
  subjectIds: z.array(z.string().uuid()).min(1).optional(),
  classeIds: z.array(z.string().uuid()).min(1).optional(),
});

export type CreateVideoResourceInput = z.infer<
  typeof createVideoResourceSchema
>;
export type CreateDocumentResourceInput = z.infer<
  typeof createDocumentResourceSchema
>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
