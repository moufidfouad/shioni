import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// État vide générique (section 32 de la refonte UX/UI, itération 26) :
// jusqu'ici chaque page affichait un simple texte gris dans une cellule de
// tableau ("Aucun résultat.", voir DataTable.tsx) — correct mais sans jamais
// orienter l'utilisateur vers l'action qui résout le vide. Ce composant est
// pour un écran ENTIER sans donnée (ex: aucune classe encore créée) ; le
// texte court de DataTable reste approprié pour "aucun résultat après
// filtrage" à l'intérieur d'un tableau déjà peuplé par ailleurs — ne pas
// remplacer l'un par l'autre sans discernement.
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center",
        className
      )}
    >
      {Icon && (
        <div className="flex size-11 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
