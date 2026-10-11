import { useEffect, useRef } from "react";

// Sélecteur des éléments focusables considérés par le piège de focus /
// Tab-cycle ci-dessous — même liste minimale que les patrons usuels
// (liens avec `href`, boutons non désactivés, `tabindex` explicite positif).
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Étape 4, Vague 2 — extrait de `Sidebar.tsx` (itération 53, Vague 0), où ce
// piège de focus + fermeture `Escape` avait été écrit une première fois pour
// le panneau mobile de la sidebar école. Le menu mobile public (`PublicNavbar`,
// même itération que ce hook) en a besoin à l'identique : généralisé ici
// plutôt que copié-collé une seconde fois. `Sidebar.tsx` a été migré vers ce
// hook dans le même mouvement, comportement inchangé.
//
// Usage : poser le `ref` retourné sur le conteneur `role="dialog"` du
// panneau (avec `tabIndex={-1}` dessus, pour recevoir le focus par défaut
// faute d'élément focusable interne).
//
//   const panelRef = useDialogFocusTrap<HTMLElement>(open, onClose);
//   <aside ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1}>...
export function useDialogFocusTrap<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const panelRef = useRef<T>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus déplacé dans le panneau à l'ouverture (norme "dialog" WAI-ARIA) —
    // à défaut d'élément focusable, le panneau lui-même reçoit le focus
    // (nécessite le `tabIndex={-1}` posé sur le conteneur par l'appelant).
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // Piège de focus : Tab sur le dernier élément revient au premier,
      // Shift+Tab sur le premier revient au dernier — le focus ne quitte
      // jamais le panneau tant qu'il est ouvert.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Rend le focus à l'élément qui l'avait avant l'ouverture (le bouton
      // "menu" ayant déclenché le panneau, en pratique) plutôt que de le
      // laisser retomber sur `<body>`.
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onClose]);

  return panelRef;
}
