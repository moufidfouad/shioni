import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

// Phase 3a (itération 76) — hook partagé par OfflineBanner.tsx (bandeau
// global) ET par tout écran de SAISIE qui doit se bloquer explicitement
// hors ligne plutôt que de laisser un appel réseau échouer silencieusement
// (voir messaging/[conversationId].tsx — seul écran d'écriture du mobile
// pour l'instant ; plan mobile section 4.6 : "bloquer explicitement les
// écrans de saisie... avec un message clair"). Un seul abonnement NetInfo
// par composant plutôt qu'un état global partagé : le coût d'un abonnement
// supplémentaire est négligeable, et ça évite d'introduire un nouveau
// Provider React pour un simple booléen.
export function useIsOffline(): boolean {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      // `isConnected === false` seulement — `null` (statut pas encore connu,
      // au tout premier rendu) n'est PAS traité comme hors ligne, pour ne
      // jamais afficher le bandeau/bloquer la saisie par erreur le temps
      // que NetInfo réponde.
      setIsOffline(state.isConnected === false);
    });
  }, []);

  return isOffline;
}
