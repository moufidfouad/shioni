import { cn } from "@/lib/utils";

// Bloc de base pour tout état de chargement "skeleton" (itération 26) —
// remplace les textes bruts "Chargement…" utilisés jusqu'ici page par page
// (StatCard/DataTable notamment). `animate-pulse` + `bg-muted` uniquement :
// pas de dépendance ajoutée, cohérent avec le design system existant.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

// Repli pour une grille de StatCard pendant le chargement d'un dashboard —
// mêmes proportions qu'une StatCard réelle pour éviter tout saut de mise en
// page (layout shift) une fois la donnée arrivée.
export function SkeletonStatCard() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-2 h-7 w-16" />
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  );
}

// Repli pour une ligne de DataTable pendant le chargement — `cols` doit
// correspondre approximativement au nombre de colonnes réelles de la table
// visée, pour que la largeur globale reste cohérente.
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-3">
          <Skeleton className="h-4 w-full max-w-32" />
        </td>
      ))}
    </tr>
  );
}
