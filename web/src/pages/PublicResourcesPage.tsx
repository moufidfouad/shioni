import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, FileText, MapPin, School as SchoolIcon, Video } from "lucide-react";
import {
  usePublicResourceFiltersQuery,
  usePublicResourcesQuery,
  publicResourceDownloadUrl,
} from "../features/public-resources/api";
import type { PublicResource, PublicResourcesFilters, ResourceType } from "../types";
import PageHeader from "../components/PageHeader";
import PageTransition from "@/components/motion/PageTransition";
import ErrorState from "@/components/ErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/Skeleton";

// Itération 48 — partage de ressources au public. Page PUBLIQUE (aucune
// authentification, voir PublicLayout.tsx/App.tsx) : cadrage utilisateur
// verbatim — "une page publique (sans authentification) où toutes les
// ressources des différentes écoles sont publiées (avec possibilité de
// filtre multiple par établissement, classe, série, cycle, matière)".
//
// Itération 50 — demande utilisateur, verbatim : "placer les filtres dans
// barre verticale à gauche" / "éviter que les noms de cycle, classe, série,
// matière se répétent dans les combos" / "permettre les select multiple".
// Trois changements groupés dans cette même page :
//  (1) Filtres déplacés d'une barre horizontale au-dessus des résultats vers
//      une colonne verticale à gauche (`<aside>`), résultats dans la colonne
//      restante — patron de mise en page filtre/liste classique.
//  (2) Un nom de cycle/classe/série/matière peut exister IDENTIQUE dans
//      plusieurs écoles (ex. "6ème" à la fois à ÉCOLE EXCELLENCE et à
//      COLLÈGE AL-CAMAR) : sans regroupement, la liste "toutes écoles"
//      affichait la même étiquette deux fois avec des ids différents,
//      illisible pour l'utilisateur. `groupByName` ci-dessous fusionne ces
//      entrées par LIBELLÉ en une seule case à cocher, dont la sélection
//      s'applique à TOUS les ids qui partagent ce nom (voir
//      `selectedXIds` ci-dessous) — sans risque de résultat incohérent
//      puisqu'une `Resource` n'est jamais liée qu'à des classes/matières de
//      SA PROPRE école (voir `resources.service.ts::
//      assertClassesInSchool`/`assertSubjectsInSchool`) : le filtre
//      "établissement" (séparé) continue de s'appliquer correctement même
//      quand un nom de classe est partagé.
//  (3) Chaque dimension passe d'un `Select` à choix unique à une liste de
//      cases à cocher (plusieurs écoles/cycles/classes/séries/matières/types
//      cumulables AU SEIN d'une même dimension). Les filtres cycle → classe
//      → série restent EN CASCADE (chaque niveau ne propose que les options
//      cohérentes avec les niveaux choisis au-dessus) — une sélection qui
//      devient incohérente après un changement en amont (ex. une classe
//      cochée qui n'appartient à aucun des cycles nouvellement cochés) est
//      automatiquement décochée (voir les `useEffect` de "purge" plus bas),
//      plutôt que de réinitialiser brutalement TOUTE la sélection à chaque
//      changement en amont. Entre dimensions différentes, le backend
//      combine toujours en ET (`publicResources.service.ts`) ; au sein
//      d'une dimension, en OU (`in: [...ids]`) — inchangé par rapport à
//      l'itération 48, seulement pluralisé.

const PAGE_SIZE = 12;

const TYPE_LABELS: Record<ResourceType, string> = { DOCUMENT: "Document", VIDEO: "Vidéo" };

function formatSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// Convertit un lien YouTube/Vimeo "classique" en URL d'intégration (iframe).
// Cadrage utilisateur : lien externe uniquement, jamais de fichier vidéo
// uploadé — un lien qui ne correspond à aucun des deux formats reconnus
// reste affiché comme simple lien externe plutôt que de faire échouer
// l'affichage de la carte.
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

// Regroupe une liste d'entités par LIBELLÉ (voir (2) dans le commentaire
// d'en-tête) : conserve l'ordre de première apparition (les options
// arrivent déjà triées par le backend — `order`/`name` selon le modèle,
// voir `publicResources.service.ts::listPublicFilterOptions`).
function groupByName<T extends { id: string; name: string }>(items: T[]): { name: string; ids: string[] }[] {
  const order: string[] = [];
  const idsByName = new Map<string, string[]>();
  for (const item of items) {
    const existing = idsByName.get(item.name);
    if (existing) {
      existing.push(item.id);
    } else {
      idsByName.set(item.name, [item.id]);
      order.push(item.name);
    }
  }
  return order.map((name) => ({ name, ids: idsByName.get(name) ?? [] }));
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface FilterOption {
  key: string;
  label: string;
}

// Une section de la barre de filtres verticale : titre + liste de cases à
// cocher. Rendu vide (`null`) tant qu'aucune option n'est disponible — évite
// une section "Série" vide par défaut avant tout chargement/sélection.
function FilterSection({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="space-y-1.5">
        {options.map((opt) => (
          <label key={opt.key} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={selected.includes(opt.key)} onCheckedChange={() => onToggle(opt.key)} />
            <span className={selected.includes(opt.key) ? "text-foreground" : undefined}>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ResourceCard({ resource }: { resource: PublicResource }) {
  const embedUrl = resource.type === "VIDEO" && resource.videoUrl ? toEmbedUrl(resource.videoUrl) : null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{resource.title}</CardTitle>
          <Badge variant={resource.type === "DOCUMENT" ? "default" : "secondary"} className="shrink-0">
            {resource.type === "DOCUMENT" ? <FileText className="mr-1 size-3" /> : <Video className="mr-1 size-3" />}
            {TYPE_LABELS[resource.type]}
          </Badge>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <SchoolIcon className="size-3" />
          {resource.school.name}
          {resource.school.island && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {resource.school.island}
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {resource.description && <p className="text-sm text-muted-foreground">{resource.description}</p>}

        <div className="flex flex-wrap gap-1">
          {resource.classes.map((c) => (
            <Badge key={c.classe.id} variant="outline" className="text-xs">
              {c.classe.name}
            </Badge>
          ))}
          {resource.subjects.map((s) => (
            <Badge key={s.subject.id} variant="outline" className="text-xs">
              {s.subject.name}
            </Badge>
          ))}
        </div>

        <div className="mt-auto pt-2">
          {resource.type === "DOCUMENT" ? (
            <Button asChild size="sm" className="w-full">
              <a href={publicResourceDownloadUrl(resource.id)}>
                <Download className="mr-2 size-4" />
                Télécharger{resource.fileSize ? ` (${formatSize(resource.fileSize)})` : ""}
              </a>
            </Button>
          ) : embedUrl ? (
            <div className="aspect-video overflow-hidden rounded-md border">
              <iframe
                src={embedUrl}
                title={resource.title}
                className="size-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            resource.videoUrl && (
              <Button asChild size="sm" variant="outline" className="w-full">
                <a href={resource.videoUrl} target="_blank" rel="noreferrer">
                  <Video className="mr-2 size-4" />
                  Voir la vidéo
                </a>
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PublicResourcesPage() {
  // Étape 4, Vague 2 (audit §4.1/§5 point 3) — filtres désormais
  // synchronisés à l'URL, comme les six pages de la Vague 1. Chaque
  // dimension est une liste de valeurs répétées sous la même clé de query
  // param (`?cycles=6eme&cycles=5eme`), lue via `searchParams.getAll(...)`.
  // Composé directement avec `useSearchParams` (comme AnalyticsPage.tsx)
  // plutôt que le hook générique `useSearchParamsState` : cocher/décocher
  // une valeur doit réinitialiser la pagination dans le MÊME geste (deux
  // clés qui changent ensemble), et les effets de purge en cascade
  // ci-dessous doivent pouvoir réécrire une dimension sans passer par un
  // state React séparé à resynchroniser avec l'URL.
  const [searchParams, setSearchParams] = useSearchParams();

  const schoolIds = searchParams.getAll("schools");
  const cycleNames = searchParams.getAll("cycles");
  const classeNames = searchParams.getAll("classes");
  const serieNames = searchParams.getAll("series");
  const subjectNames = searchParams.getAll("subjects");
  const types = searchParams.getAll("types") as ResourceType[];
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  // Réécrit intégralement la liste de valeurs d'UNE clé ; `resetPage` efface
  // aussi la pagination dans le même appel (évite de rester sur une page qui
  // n'existe plus une fois le résultat filtré différent).
  function setListParam(key: string, values: string[], resetPage: boolean) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete(key);
        values.forEach((v) => params.append(key, v));
        if (resetPage) params.delete("page");
        return params;
      },
      { replace: true }
    );
  }

  function goToPage(next: number) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next <= 1) params.delete("page");
        else params.set("page", String(next));
        return params;
      },
      { replace: true }
    );
  }

  const filtersOptionsQuery = usePublicResourceFiltersQuery();
  const options = filtersOptionsQuery.data;

  // Résolution nom -> ids réels, toujours depuis la liste COMPLÈTE (pas la
  // liste déjà restreinte par la cascade ci-dessous) : un nom sélectionné
  // désigne TOUJOURS le même ensemble d'ids, indépendamment de ce que
  // l'utilisateur a choisi par ailleurs (seul l'AFFICHAGE est restreint par
  // la cascade, jamais la résolution).
  const selectedCycleIds = useMemo(
    () => (options?.cycles ?? []).filter((c) => cycleNames.includes(c.name)).map((c) => c.id),
    [options, cycleNames]
  );
  const selectedClasseIds = useMemo(
    () => (options?.classes ?? []).filter((c) => classeNames.includes(c.name)).map((c) => c.id),
    [options, classeNames]
  );
  const selectedSerieIds = useMemo(
    () => (options?.series ?? []).filter((s) => serieNames.includes(s.name)).map((s) => s.id),
    [options, serieNames]
  );
  const selectedSubjectIds = useMemo(
    () => (options?.subjects ?? []).filter((s) => subjectNames.includes(s.name)).map((s) => s.id),
    [options, subjectNames]
  );

  const filters: PublicResourcesFilters = {
    schoolIds: schoolIds.length ? schoolIds : undefined,
    cycleIds: selectedCycleIds.length ? selectedCycleIds : undefined,
    classeIds: selectedClasseIds.length ? selectedClasseIds : undefined,
    serieIds: selectedSerieIds.length ? selectedSerieIds : undefined,
    subjectIds: selectedSubjectIds.length ? selectedSubjectIds : undefined,
    types: types.length ? types : undefined,
  };
  const resourcesQuery = usePublicResourcesQuery(filters, page, PAGE_SIZE);
  const result = resourcesQuery.data;

  // Cascade + regroupement par nom (voir (1)/(2) dans le commentaire
  // d'en-tête) : chaque section ne propose que les options cohérentes avec
  // les niveaux déjà choisis au-dessus, un nom qui existe dans plusieurs
  // écoles/classes n'apparaît qu'une seule fois.
  const cycleOptions = useMemo(() => {
    const raw = (options?.cycles ?? []).filter((c) => schoolIds.length === 0 || schoolIds.includes(c.schoolId));
    return groupByName(raw);
  }, [options, schoolIds]);

  const classeOptions = useMemo(() => {
    const raw = (options?.classes ?? []).filter(
      (c) =>
        (schoolIds.length === 0 || schoolIds.includes(c.schoolId)) &&
        (selectedCycleIds.length === 0 || selectedCycleIds.includes(c.cycleId))
    );
    return groupByName(raw);
  }, [options, schoolIds, selectedCycleIds]);

  const serieOptions = useMemo(() => {
    const raw = (options?.series ?? []).filter(
      (s) =>
        (schoolIds.length === 0 || schoolIds.includes(s.schoolId)) &&
        (selectedClasseIds.length === 0 || selectedClasseIds.includes(s.classeId))
    );
    return groupByName(raw);
  }, [options, schoolIds, selectedClasseIds]);

  const subjectOptions = useMemo(() => {
    const raw = (options?.subjects ?? []).filter((s) => schoolIds.length === 0 || schoolIds.includes(s.schoolId));
    return groupByName(raw);
  }, [options, schoolIds]);

  // Purge automatique : un nom coché qui ne fait plus partie des options
  // affichées (parce qu'un niveau au-dessus vient de changer) est décoché,
  // sans toucher aux autres sélections de ce même niveau — voir (3) dans le
  // commentaire d'en-tête. Comparaison de longueur avant écriture : évite un
  // `setSearchParams` (et donc un re-render) quand rien n'a réellement
  // changé. `cycleNames`/`setListParam` sont volontairement omis des
  // dépendances : l'effet ne doit réagir qu'à un changement des OPTIONS
  // disponibles, pas à la sélection elle-même (qui vient de changer à
  // l'instant, via `onToggle` ci-dessous, pas via ce purge).
  useEffect(() => {
    const next = cycleNames.filter((n) => cycleOptions.some((o) => o.name === n));
    if (next.length !== cycleNames.length) setListParam("cycles", next, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleOptions]);
  useEffect(() => {
    const next = classeNames.filter((n) => classeOptions.some((o) => o.name === n));
    if (next.length !== classeNames.length) setListParam("classes", next, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classeOptions]);
  useEffect(() => {
    const next = serieNames.filter((n) => serieOptions.some((o) => o.name === n));
    if (next.length !== serieNames.length) setListParam("series", next, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serieOptions]);
  useEffect(() => {
    const next = subjectNames.filter((n) => subjectOptions.some((o) => o.name === n));
    if (next.length !== subjectNames.length) setListParam("subjects", next, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectOptions]);

  const activeFilterCount =
    schoolIds.length + cycleNames.length + classeNames.length + serieNames.length + subjectNames.length + types.length;

  function resetFilters() {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  function onToggle<T extends string>(key: string, current: T[], value: T) {
    setListParam(key, toggleValue(current, value), true);
  }

  const totalPages = result?.pagination.totalPages ?? 1;

  return (
    <PageTransition className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <PageHeader
        title="Ressources pédagogiques"
        description="Documents et vidéos partagés par les établissements — accessible sans connexion."
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="w-full shrink-0 space-y-4 rounded-md border p-4 lg:w-64">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Filtres</p>
            {activeFilterCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-auto px-2 py-1 text-xs text-muted-foreground"
              >
                Réinitialiser ({activeFilterCount})
              </Button>
            )}
          </div>

          <FilterSection
            title="Établissement"
            options={(options?.schools ?? []).map((s) => ({ key: s.id, label: s.name }))}
            selected={schoolIds}
            onToggle={(key) => onToggle("schools", schoolIds, key)}
          />
          <FilterSection
            title="Cycle"
            options={cycleOptions.map((o) => ({ key: o.name, label: o.name }))}
            selected={cycleNames}
            onToggle={(key) => onToggle("cycles", cycleNames, key)}
          />
          <FilterSection
            title="Classe"
            options={classeOptions.map((o) => ({ key: o.name, label: o.name }))}
            selected={classeNames}
            onToggle={(key) => onToggle("classes", classeNames, key)}
          />
          <FilterSection
            title="Série"
            options={serieOptions.map((o) => ({ key: o.name, label: o.name }))}
            selected={serieNames}
            onToggle={(key) => onToggle("series", serieNames, key)}
          />
          <FilterSection
            title="Matière"
            options={subjectOptions.map((o) => ({ key: o.name, label: o.name }))}
            selected={subjectNames}
            onToggle={(key) => onToggle("subjects", subjectNames, key)}
          />
          <FilterSection
            title="Type"
            options={[
              { key: "DOCUMENT", label: "Document" },
              { key: "VIDEO", label: "Vidéo" },
            ]}
            selected={types}
            onToggle={(key) => onToggle("types", types, key as ResourceType)}
          />
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          {resourcesQuery.isError ? (
            <ErrorState onRetry={() => resourcesQuery.refetch()} />
          ) : resourcesQuery.isLoading ? (
            // Itération 108 — constat Lighthouse "CLS" (itération 60) : décalage
            // notable sur la page publique Ressources (0.217). 6 cartes squelette
            // fixes contre `PAGE_SIZE` = 12 cartes réelles au chargement : la grille
            // pouvait doubler de hauteur (2 rangées -> jusqu'à 4) une fois les
            // données arrivées. `PAGE_SIZE` cartes squelette réservent la hauteur
            // attendue d'une page pleine.
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <Skeleton key={i} className="h-56 w-full" />
              ))}
            </div>
          ) : !result || result.data.length === 0 ? (
            <p className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
              Aucune ressource ne correspond à ces filtres.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.data.map((r) => (
                  <ResourceCard key={r.id} resource={r} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {result.pagination.total} résultat{result.pagination.total > 1 ? "s" : ""} · page {result.pagination.page}/
                    {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => goToPage(Math.max(1, page - 1))}
                    >
                      <ChevronLeft className="size-4" />
                      Précédent
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => goToPage(Math.min(totalPages, page + 1))}
                    >
                      Suivant
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
