import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { AdminTestimonial, Testimonial } from "@/types";


export const testimonialsKeys = {
  list: () => ["public-testimonials"] as const,
};

export function usePublicTestimonialsQuery() {
  return useQuery({
    queryKey: testimonialsKeys.list(),
    queryFn: async ({ signal }) => (await api.get<Testimonial[]>("/public/testimonials", { signal })).data,
    // Contenu éditorial, change rarement — même raisonnement que
    // `usePublicResourceFiltersQuery`.
    staleTime: 60_000,
  });
}


export const adminTestimonialsKeys = {
  list: () => ["admin-testimonials"] as const,
};

export function useAdminTestimonialsQuery() {
  return useQuery({
    queryKey: adminTestimonialsKeys.list(),
    queryFn: async ({ signal }) => (await api.get<AdminTestimonial[]>("/admin/testimonials", { signal })).data,
  });
}

export interface TestimonialUpsertPayload {
  id?: string;
  authorName: string;
  authorRole: string;
  content: string;
  published?: boolean;
  order?: number;
}

// `useCrudTab` (voir hooks/useCrudTab.ts) attend un seul mutateAsync pour
// création ET modification — même convention que
// features/parameters/api.ts::useUpsertCycleMutation, le backend distingue
// les deux par la présence de `id` dans le corps (voir
// admin-testimonials.service.ts::upsertTestimonial).
export function useUpsertTestimonialMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TestimonialUpsertPayload) => (await api.post("/admin/testimonials", payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminTestimonialsKeys.list() });
      // La landing page publique peut être ouverte dans un autre onglet
      // pendant que l'admin édite — invalider aussi sa clé de cache reste
      // sans risque (un simple refetch si elle est montée) et évite un
      // témoignage visiblement périmé.
      queryClient.invalidateQueries({ queryKey: testimonialsKeys.list() });
    },
  });
}

export function useDeleteTestimonialMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/admin/testimonials/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminTestimonialsKeys.list() });
      queryClient.invalidateQueries({ queryKey: testimonialsKeys.list() });
    },
  });
}
