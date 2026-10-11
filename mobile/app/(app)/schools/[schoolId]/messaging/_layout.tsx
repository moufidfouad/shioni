import { Stack, useLocalSearchParams } from "expo-router";
import { MessagingSocketProvider } from "@/src/lib/messagingSocket";

// Groupe de routes "Messagerie" (Phase 2c, itération 74) — un seul socket
// pour toute la navigation dans ce groupe (liste + fil de discussion),
// ouvert à l'entrée et fermé à la sortie (retour au Tableau de bord) plutôt
// que reconnecté à chaque écran — voir le commentaire d'en-tête de
// src/lib/messagingSocket.tsx.
export default function MessagingLayout() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  return (
    <MessagingSocketProvider schoolId={schoolId}>
      <Stack />
    </MessagingSocketProvider>
  );
}
