import { z } from "zod";

// Itération 62 — mêmes contraintes que le formulaire frontend
// (`Contact.tsx`, schéma Yup) : ne jamais faire confiance à la seule
// validation côté client sur une route PUBLIQUE, sans authentification.
export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, "2 caractères minimum").max(200),
  email: z.string().trim().email("Email invalide."),
  subject: z.string().trim().min(3, "3 caractères minimum").max(200),
  message: z.string().trim().min(10, "10 caractères minimum").max(5000),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
