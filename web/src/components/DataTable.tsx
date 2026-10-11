import { Fragment, memo, ReactNode, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonRow } from "@/components/Skeleton";

// Composant DataTable générique et réutilisable, construit sur les primitives
// shadcn/ui existantes (Table, Button, Input) plutôt que sur une librairie
// tierce. Justification : `@tanstack/react-table` v9 (la seule version
// disponible sur le registre au moment de l'écriture) expose une API dont je
// n'ai pas de connaissance fiable/vérifiée (son `package.json` référence un
// sous-chemin "./legacy" distinct de ".", et son README documente un tout
// nouvel outillage IA spécifique à la v9 — signe fort d'un changement d'API
// majeur par rapport à la v8, largement connue). Pour éviter de livrer du
// code contre une API devinée, cette table est écrite à la main : colonnes
// déclaratives, pagination client, recherche optionnelle, états
// chargement/vide.
export interface DataTableColumn<T> {
  /** Libellé affiché dans l'en-tête de colonne. */
  header: string;
  /** Rendu de la cellule pour une ligne donnée. */
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

// Correctif audit (pagination serveur) — quand `serverPagination` est
// fourni, `data` est supposé être DÉJÀ la page courante (renvoyée par le
// backend, voir utils/pagination.ts côté serveur) : le composant n'effectue
// plus aucun découpage côté client et pilote ses contrôles existants
// (indicateur de page, précédent/suivant) depuis ces props/callbacks plutôt
// que depuis son état interne `page`. Absent, le comportement reste
// EXACTEMENT celui d'avant (pagination 100% client, `pageSize` par défaut
// 10) — pour les pages qui n'ont pas encore été migrées.
export interface ServerPagination {
  /** Page courante, 1-based — reflète `pagination.page` renvoyé par l'API. */
  page: number;
  pageSize: number;
  /** Nombre total de lignes toutes pages confondues (`pagination.total`). */
  total: number;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Extrait une clé React stable pour chaque ligne. */
  rowKey: (row: T) => string | number;
  pageSize?: number;
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  /** Active la barre de recherche client au-dessus de la table. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Valeur textuelle utilisée pour filtrer une ligne quand `searchable` est actif. */
  getSearchValue?: (row: T) => string;
  /** Rendu optionnel d'actions par ligne (boutons éditer/supprimer, etc.). */
  rowActions?: (row: T) => ReactNode;
  /** Indique si une ligne donnée doit afficher son contenu déplié. */
  isRowExpanded?: (row: T) => boolean;
  /**
   * Rendu du contenu déplié sous une ligne (ex : coefficients d'une
   * matière). N'affecte pas la pagination : seules les lignes "de premier
   * niveau" comptent pour le calcul des pages.
   */
  renderExpandedRow?: (row: T) => ReactNode;
  /**
   * Bascule la pagination en mode "serveur" : `data` est déjà la page
   * courante, et les contrôles (précédent/suivant/indicateur) sont pilotés
   * par ces props plutôt que par l'état interne du composant. Voir le
   * commentaire au-dessus de `ServerPagination`.
   */
  serverPagination?: ServerPagination;
}

function DataTable<T>({
  columns,
  data,
  rowKey,
  pageSize = 10,
  emptyMessage = "Aucun résultat.",
  loading = false,
  loadingMessage = "Chargement…",
  searchable = false,
  searchPlaceholder = "Rechercher…",
  getSearchValue,
  rowActions,
  isRowExpanded,
  renderExpandedRow,
  serverPagination,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchable || !query.trim() || !getSearchValue) return data;
    const q = query.trim().toLowerCase();
    return data.filter((row) => getSearchValue(row).toLowerCase().includes(q));
  }, [data, query, searchable, getSearchValue]);

  // Revenir en page 1 quand la recherche ou le jeu de données change, pour
  // éviter de se retrouver sur une page devenue vide. Non pertinent en mode
  // serveur : c'est l'appelant (via `onPageChange`) qui possède la page
  // courante, ce composant ne doit pas la réinitialiser dans son dos.
  useEffect(() => {
    if (serverPagination) return;
    setPage(1);
  }, [query, data.length, serverPagination]);

  const effectivePageSize = serverPagination?.pageSize ?? pageSize;
  const totalCount = serverPagination ? serverPagination.total : filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / effectivePageSize));
  const safePage = serverPagination ? Math.min(Math.max(1, serverPagination.page), totalPages) : Math.min(page, totalPages);
  // En mode serveur, `data` EST déjà la page courante — aucun découpage
  // supplémentaire ; en mode client (comportement historique), on tranche
  // `filtered` localement.
  const pageRows = serverPagination ? data : filtered.slice((safePage - 1) * effectivePageSize, safePage * effectivePageSize);
  const colSpan = columns.length + (rowActions ? 1 : 0);

  function goToPage(next: number) {
    if (serverPagination) {
      serverPagination.onPageChange(Math.min(Math.max(1, next), totalPages));
    } else {
      setPage(Math.min(Math.max(1, next), totalPages));
    }
  }

  return (
    <div className="space-y-3">
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
          />
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, i) => (
                <TableHead key={i} className={col.headerClassName}>
                  {col.header}
                </TableHead>
              ))}
              {rowActions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <>
                {/* Audit frontend Étape 2 : `SkeletonRow` (components/Skeleton.tsx)
                    existait déjà depuis l'itération 26 mais n'était câblé nulle
                    part — chaque DataTable retombait sur un simple texte
                    "Chargement…" au lieu du repli squelette prévu pour elle.
                    Le texte reste présent mais en `sr-only` : `SkeletonRow` est
                    purement visuel (pas de sens pour un lecteur d'écran), c'est
                    cette ligne qui porte l'annonce accessible. */}
                <TableRow>
                  <TableCell colSpan={colSpan} className="sr-only" role="status">
                    {loadingMessage}
                  </TableCell>
                </TableRow>
                {/* Itération 108 — constat Lighthouse "CLS" (itération 60) : décalage
                    notable sur Élèves (0.287). Ce plafond à 5 lignes squelette, quel
                    que soit `effectivePageSize`, réservait beaucoup moins d'espace que
                    le contenu réel une fois chargé (ex. StudentsPage utilise une page
                    de 20 lignes) : le tableau grandissait brutalement au chargement,
                    décalant tout ce qui suit. Réserver `effectivePageSize` lignes fait
                    correspondre la hauteur du squelette à la hauteur attendue du
                    contenu réel (page pleine) dans l'immense majorité des cas. */}
                {Array.from({ length: effectivePageSize }).map((_, i) => (
                  <SkeletonRow key={i} cols={colSpan} />
                ))}
              </>
            ) : pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => {
                const expanded = isRowExpanded?.(row) ?? false;
                return (
                  <Fragment key={rowKey(row)}>
                    <TableRow>
                      {columns.map((col, i) => (
                        <TableCell key={i} className={col.className}>
                          {col.cell(row)}
                        </TableCell>
                      ))}
                      {rowActions && <TableCell className="text-right">{rowActions(row)}</TableCell>}
                    </TableRow>
                    {expanded && renderExpandedRow && (
                      <TableRow>
                        <TableCell colSpan={colSpan} className="bg-muted/30">
                          {renderExpandedRow(row)}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {!loading && totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {totalCount} résultat{totalCount > 1 ? "s" : ""} · page {safePage}/{totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => goToPage(safePage - 1)}
            >
              <ChevronLeft className="size-4" />
              Précédent
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => goToPage(safePage + 1)}
            >
              Suivant
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// `memo` loses the generic signature of `DataTable<T>` (it types the wrapped
// component as if `T` were fixed), so the cast restores it — every call site
// imports this default export and instantiates it with its own row type
// (`DataTable<Student>`, `DataTable<Grade>`, etc.), which must keep working
// unchanged.
export default memo(DataTable) as typeof DataTable;
