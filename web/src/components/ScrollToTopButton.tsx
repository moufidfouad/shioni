import { useCallback, useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

// Seuil (px) de défilement à partir duquel le bouton apparaît — évite de
// l'afficher dès le premier pixel scrollé, seulement quand remonter en haut
// devient réellement utile.
const SHOW_AFTER_PX = 320;

// Bouton flottant "remonter en haut de page", monté une seule fois dans
// main.tsx (même patron que <Toaster>, itération 12) plutôt que rajouté
// page par page : aucune des coquilles de mise en page (`PublicLayout`,
// `SchoolLayout`) ne crée son propre conteneur défilant (pas d'`overflow-y-
// auto`), tout le défilement se fait donc sur `window` — un seul écouteur
// global suffit pour toute l'application.
export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <Button
      type="button"
      size="icon"
      onClick={scrollToTop}
      aria-label="Remonter en haut de la page"
      title="Remonter en haut de la page"
      className={cn(
        "fixed bottom-6 right-6 z-40 rounded-full shadow-lg transition-opacity duration-200",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      <ArrowUp />
    </Button>
  );
}
