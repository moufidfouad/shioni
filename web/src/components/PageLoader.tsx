import { Loader2 } from "lucide-react";

// Repli affiché par le <Suspense> pendant le chargement d'une page en lazy
// loading (voir App.tsx::const XxxPage = lazy(() => import(...))) — pendant
// que le navigateur télécharge le chunk JS de la page demandée. Remplace
// aussi le texte brut "Chargement…" utilisé jusqu'ici dans
// ProtectedRoute.tsx (vérification de la session au démarrage) : un seul
// indicateur de chargement pour toute l'application plutôt que plusieurs
// variantes ad hoc.
export default function PageLoader() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">Chargement…</p>
    </div>
  );
}
