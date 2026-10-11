import { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConfirmDialogProps {
  /** Contrôle l'ouverture — le composant est entièrement piloté par le parent. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Peut être async (ex : mutateAsync) ; le dialogue ne se ferme pas tout seul, c'est au
   * parent de faire onOpenChange(false) une fois la suppression réussie. */
  onConfirm: () => void | Promise<void>;
  /** Désactive les boutons et affiche un libellé "en cours" pendant la mutation. */
  loading?: boolean;
  /** Libellé affiché sur le bouton de confirmation pendant `loading` — par défaut
   * "Suppression…" (usage historique de ce composant, presque toujours une suppression).
   * À surcharger pour un usage non destructif (ex : "Enregistrement…"). */
  loadingLabel?: string;
  variant?: "destructive" | "default";
}


export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Supprimer",
  cancelLabel = "Annuler",
  onConfirm,
  loading = false,
  loadingLabel = "Suppression…",
  variant = "destructive",
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent hideClose>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={loading}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button type="button" variant={variant} disabled={loading} onClick={() => onConfirm()}>
            {loading ? loadingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
