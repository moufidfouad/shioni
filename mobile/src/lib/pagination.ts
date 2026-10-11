import { Paginated } from "../types";

// Phase 4 (itération 81) — extraction pure, sans changement de
// comportement : cette logique était dupliquée à l'identique dans
// `src/api/students.ts` et `src/api/personnel.ts` (Phase 2d, itération 75),
// seuls deux consommateurs du contrat page/pageSize partagé
// (`backend/src/utils/pagination.ts`) via `useInfiniteQuery` côté mobile.
// Messagerie N'EST PAS concernée — pagination par curseur (`Message.seq`),
// contrat différent, voir `src/api/messaging.ts` (commentaire déjà présent
// à l'itération 74). Extraite ici pour (1) éliminer la duplication et (2)
// rendre cette règle testable isolément (voir `pagination.test.ts`) sans
// dépendre de React Query ni d'un appel réseau.
export function getNextPageParam<T>(last: Paginated<T>): number | undefined {
  return last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined;
}
