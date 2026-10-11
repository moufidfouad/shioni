// Extrait à l'itération 58 (audit §4.4/§6 Should : "Progression d'upload...
// sur Ressources et pièces jointes messagerie") — deux usages dès la
// première livraison (ResourcesPage.tsx, ChatWindow.tsx), donc partagé
// directement plutôt que dupliqué une fois puis extrait au second besoin
// (convention actée à l'itération 55, confirmée s'appliquer aux composants
// à l'itération 57 : ici les deux usages arrivent dans le même lot, donc
// partagé dès le départ).
interface UploadProgressProps {
  /** Pourcentage 0-100, calculé depuis `ProgressEvent.loaded`/`total` d'axios. */
  percent: number;
  label?: string;
}

export default function UploadProgress({ percent, label }: UploadProgressProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="space-y-1">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Envoi en cours"}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
