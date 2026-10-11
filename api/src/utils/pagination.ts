import { z } from "zod";

// Contrat de pagination PARTAGÉ par les 6 modules à liste potentiellement
// longue (students, attendance, grades, enrollments, finances, personnel) —
// correctif audit (scalabilité) : ces listes chargeaient jusqu'ici la table
// entière côté serveur, `DataTable` (frontend) ne paginant que ce qui était
// déjà en mémoire du navigateur. `page` (1-based) et `pageSize` sont validés
// et coercés depuis la query string (toujours des chaînes à ce stade) via
// Zod, `pageSize` étant en plus PLAFONNÉ à `MAX_PAGE_SIZE` plutôt que rejeté
// au-delà — un client qui demande `pageSize=5000` obtient silencieusement
// une page de taille `MAX_PAGE_SIZE`, sans erreur 400 pour une intention par
// ailleurs légitime (voir `parsePagination`).
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().default(DEFAULT_PAGE_SIZE),
});

// `all` : échappatoire délibérée (voir commentaire de `parsePagination`) —
// pas dans le schéma Zod ci-dessus (juste une chaîne "true"/"1" optionnelle,
// pas besoin d'une validation stricte pour un simple booléen de query string).
export interface PaginationQuery {
  all: boolean;
  page: number;
  pageSize: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Forme de réponse IDENTIQUE sur les 6 endpoints de liste concernés, pour que
// le frontend puisse partager un seul type/hook de pagination plutôt que
// d'en réinventer un par module.
export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

// À appeler avec `req.query` (ou un sous-objet contenant `page`/`pageSize`/
// `all`) : lève une `ZodError` (400, cf. errorHandler.ts) si `page`/
// `pageSize` sont présents mais non numériques/non positifs, sinon renvoie
// des valeurs déjà normalisées (`pageSize` plafonné).
//
// `all=true` (ou `all=1`) : échappatoire VOLONTAIRE pour les quelques
// consommateurs internes qui ont besoin de la liste COMPLÈTE plutôt que
// d'une page (ex : le sélecteur "élève" du formulaire de création d'une
// inscription, students.ts/useStudentsQuery, ou le sélecteur "enseignant"
// alimenté par personnel.ts/useStaffQuery — voir ces fichiers frontend) —
// sans cette échappatoire, ces listes plafonneraient silencieusement à
// `MAX_PAGE_SIZE` lignes une fois la pagination serveur en place, une
// régression réelle plutôt qu'un simple changement de forme. `toSkipTake`/
// `buildPaginationMeta` ci-dessous savent l'un et l'autre honorer ce
// drapeau : aucun `*.service.ts` déjà écrit contre ces deux fonctions n'a
// besoin d'être retouché pour en bénéficier.
export function parsePagination(query: unknown): PaginationQuery {
  const parsed = paginationQuerySchema.parse(query);
  const rawAll = (query as Record<string, unknown> | null | undefined)?.all;
  const all = rawAll === "true" || rawAll === "1" || rawAll === true;
  return { all, page: parsed.page, pageSize: Math.min(parsed.pageSize, MAX_PAGE_SIZE) };
}

// `skip`/`take` prêts à l'emploi pour un `findMany` Prisma — `{}` (aucune des
// deux clés) quand `all` est actif, pour que Prisma renvoie tout ce qui
// matche `where` sans troncature.
export function toSkipTake(pagination: PaginationQuery): { skip?: number; take?: number } {
  if (pagination.all) return {};
  return { skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize };
}

// `total` doit venir d'un `count()` utilisant EXACTEMENT le même `where` que
// le `findMany` correspondant (voir chaque `*.service.ts` : le `where` est
// extrait dans une variable locale partagée par les deux appels) — sinon
// `totalPages` divergerait silencieusement du nombre de pages réellement
// naviguables. En mode `all`, la réponse reste bien `{ data, pagination }`
// (même contrat) mais `pagination` décrit une unique page contenant tout :
// `pageSize`/`total` égaux (sauf collection vide, `pageSize` plancher à 1
// pour rester une taille de page valide), `totalPages: 1`.
export function buildPaginationMeta(total: number, pagination: PaginationQuery): PaginationMeta {
  if (pagination.all) {
    return { page: 1, pageSize: Math.max(total, 1), total, totalPages: 1 };
  }
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
  };
}
