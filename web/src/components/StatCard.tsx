import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Étendu à l'itération 26 (refonte UX/UI) : `icon` et `emphasis` restent
// optionnels pour ne rien casser sur les ~10 pages qui utilisent déjà
// StatCard avec seulement label/value/hint. `emphasis` sert aux quelques
// KPI vraiment prioritaires d'un dashboard (ex: nb d'élèves) — à ne pas
// utiliser partout sous peine de recréer le problème "tout a le même poids
// visuel" identifié dans l'audit.
export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  emphasis = false,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn(emphasis && "border-primary/20", className)}>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn("mt-1 font-semibold text-foreground tabular-nums", emphasis ? "text-3xl" : "text-2xl")}>
            {value}
          </p>
          {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              emphasis ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="size-5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
