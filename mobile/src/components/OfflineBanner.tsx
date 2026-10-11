import { StyleSheet, Text, View } from "react-native";
import { useIsOffline } from "../lib/useNetworkStatus";
import { getLastSyncedAt } from "../lib/storage";

// Bandeau global "hors ligne" (Phase 3a, itération 76) — monté une seule
// fois dans app/(app)/_layout.tsx, au-dessus de tout le reste du groupe
// (app)/, donc visible quel que soit l'écran affiché. Répond explicitement
// au plan mobile (section 4.6) : "un indicateur visuel « dernière
// synchronisation à ... » plutôt qu'un système de synchronisation silencieux
// qui masquerait la fraîcheur réelle des données" — les écrans continuent
// d'afficher leurs données mises en cache (voir queryClient.ts, persistance
// TanStack Query) sans qu'on masque le fait qu'elles peuvent être périmées.
export function OfflineBanner() {
  const isOffline = useIsOffline();
  if (!isOffline) return null;

  const lastSyncedAt = getLastSyncedAt();
  const label = lastSyncedAt
    ? `Dernière synchronisation à ${new Date(lastSyncedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    : "Aucune donnée synchronisée pour l'instant";

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Vous êtes hors ligne · {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: "#78350f", paddingVertical: 6, paddingHorizontal: 12 },
  text: { color: "#fff", fontSize: 12, textAlign: "center" },
});
