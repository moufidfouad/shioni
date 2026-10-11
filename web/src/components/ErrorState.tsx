import { AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// État d'erreur générique pour une SECTION de page (audit frontend Étape 1,
// §5 point 6 : `isError` de React Query n'est exploité que dans un seul
// fichier sur toute l'appli — StudentNetworkPage.tsx — partout ailleurs un
// échec réseau/serveur se rend exactement comme "aucune donnée", ce qui
// induit l'utilisateur en erreur). Même API/langage visuel que
// `EmptyState.tsx` (bordure en pointillés, icône dans un cercle, titre +
// description) pour rester cohérent, mais icône destructive et action de
// réessai en premier plan.
//
// Différence avec `ErrorPage.tsx` : celui-ci reste réservé à une PAGE
// entière (repli d'ErrorBoundary, 404) — `ErrorState` s'utilise à
// l'intérieur d'une page déjà montée, à la place du contenu d'une section
// dont la requête React Query a échoué (`query.isError`), pendant que le
// reste de la page (en-tête, autres sections) continue de s'afficher.
//
// Usage type :
//   const query = useQuery(...);
//   if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;
export default function ErrorState({
  title = "Impossible de charger les données",
  description = "Une erreur réseau ou serveur est survenue. Vous pouvez réessayer.",
  onRetry,
  retryLabel = "Réessayer",
  className,
}: {
  title?: string;
  description?: string;
  /** Typiquement `() => query.refetch()`. Le bouton est masqué si absent. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 py-12 text-center",
        className
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="size-4" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
