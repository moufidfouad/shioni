import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { Testimonial } from "../types";

// Itération 115 — pages publiques (Landing/About/Contact). Copié depuis
// frontend/src/features/{testimonials,contact}/api.ts : mêmes deux routes
// PUBLIQUES (aucune authentification requise côté backend, voir
// backend/src/app.ts::/api/public/{testimonials,contact}), donc `api`
// (client Axios mobile, voir client.ts) fonctionne ici tel quel — son
// intercepteur de requête pose juste `Authorization: Bearer <token>` SI un
// token existe déjà (utilisateur déjà connecté qui revisite ces écrans),
// jamais requis pour ces deux appels. Volet ADMIN (liste de TOUS les
// témoignages, CRUD) volontairement absent ici, comme `AdminTestimonial`
// côté types — l'administration reste une tâche web uniquement, aucun écran
// mobile de gestion ne l'exposerait de toute façon.
export const publicContentKeys = {
  testimonials: () => ["public-testimonials"] as const,
};

export function usePublicTestimonialsQuery() {
  return useQuery({
    queryKey: publicContentKeys.testimonials(),
    queryFn: async ({ signal }) => (await api.get<Testimonial[]>("/public/testimonials", { signal })).data,
    // Contenu éditorial, change rarement — même raisonnement que côté web
    // (usePublicTestimonialsQuery, features/testimonials/api.ts).
    staleTime: 60_000,
  });
}

export interface ContactMessagePayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export function useSendContactMessageMutation() {
  return useMutation({
    mutationFn: async (payload: ContactMessagePayload) => (await api.post("/public/contact", payload)).data,
  });
}
