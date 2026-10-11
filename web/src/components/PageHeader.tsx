import { ReactNode } from "react";
import { cn } from "@/lib/utils";

// En-tête de page standard (itération 26) : titre + description optionnelle
// + zone d'actions à droite (bouton principal, filtres ponctuels...). Avant
// ce composant, chaque page reconstruisait son propre en-tête ad hoc (un
// <h2> nu ici, un <div className="flex justify-between"> différent là) —
// voir StudentsPage.tsx ("Rechercher…" + bouton côte à côte sans titre de
// page du tout). Ne remplace pas les cartes de stats (StatCard) ni les
// filtres eux-mêmes, seulement le bandeau titre/actions au-dessus.
export default function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
