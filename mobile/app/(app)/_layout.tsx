import { View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/src/store/authStore";
import { OfflineBanner } from "@/src/components/OfflineBanner";

// Groupe (app) — tout ce qui exige une session. Garde d'accès UNIQUE pour
// l'ensemble du groupe (même principe que schools.routes.ts::router.use
// (authenticate) côté backend : posé une fois au niveau du routeur parent,
// pas répété dans chaque écran) : un statut différent de "signedIn" renvoie
// systématiquement vers /login, quel que soit l'écran visé. Reste vrai hors
// ligne au démarrage AVEC une session déjà connue localement (voir
// authStore.ts::bootstrap, Phase 3a itération 76) — seule une absence
// GENUINE de session (jamais connectée, ou explicitement invalidée par le
// serveur) redirige vers /login.
//
// `OfflineBanner` monté ICI (une seule fois pour tout le groupe, au-dessus
// du `<Stack />`) plutôt que par écran — visible quelle que soit la route
// active dans (app)/, même principe que <Toast /> dans app/_layout.tsx.
//
// Itération 115 — redirection changée de (auth)/login vers (public)/landing
// (nouveau point d'entrée public, voir app/index.tsx) : un logout (voir
// schools/index.tsx) ou une session expirée renvoient désormais vers le
// MÊME écran public que "/" plutôt que de sauter directement au formulaire
// de connexion, cohérent avec le choix de faire de Landing le vrai point
// d'entrée de l'app.
export default function AppLayout() {
  const status = useAuthStore((s) => s.status);
  if (status !== "signedIn") return <Redirect href="/(public)/landing" />;

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: true }} />
    </View>
  );
}
