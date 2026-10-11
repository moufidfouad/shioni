import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/src/store/authStore";

// Groupe (auth) — login/register. Symétrique de (app)/_layout.tsx : si une
// session valide existe déjà (ex. l'utilisateur revient sur /login après
// s'être connecté dans un autre onglet du navigateur... non pertinent en
// mobile, mais aussi simplement après un bootstrap qui a réussi), on
// redirige immédiatement vers l'app plutôt que de montrer un formulaire de
// connexion inutile.
export default function AuthLayout() {
  const status = useAuthStore((s) => s.status);
  if (status === "signedIn") return <Redirect href="/(app)/schools" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
