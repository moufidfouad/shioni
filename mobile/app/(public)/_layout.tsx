import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/src/store/authStore";

// Groupe (public) — Landing/About/Contact (itération 115). Nouveau point
// d'entrée de l'app pour un utilisateur NON connecté (voir app/index.tsx),
// équivalent mobile des pages publiques du web ("/", "/about", "/contact",
// voir frontend/src/App.tsx) — jusqu'ici l'app mobile n'avait AUCUN écran
// public, "/" redirigeant directement vers (auth)/login ou (app)/schools.
//
// Même garde symétrique que (auth)/_layout.tsx et (app)/_layout.tsx : un
// utilisateur déjà connecté qui atteindrait ce groupe (ex. après un
// bootstrap réussi, ou une navigation arrière) est renvoyé directement vers
// l'app plutôt que de revoir une page marketing sans objet pour lui.
export default function PublicLayout() {
  const status = useAuthStore((s) => s.status);
  if (status === "signedIn") return <Redirect href="/(app)/schools" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
