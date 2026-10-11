import { Redirect } from "expo-router";
import { useAuthStore } from "@/src/store/authStore";

// Route racine "/" — n'est atteinte, en pratique, que juste après le
// bootstrap (voir app/_layout.tsx : le statut n'est plus "booting" à ce
// stade). Se contente d'aiguiller vers le bon groupe ; toute la logique de
// garde vit dans (public)/_layout.tsx, (auth)/_layout.tsx et
// (app)/_layout.tsx, pas ici.
//
// Itération 115 — un utilisateur NON connecté atterrit désormais sur
// (public)/landing (nouveau point d'entrée marketing, équivalent mobile de
// "/" côté web) plutôt que directement sur (auth)/login : Connexion/Créer un
// compte restent à un tap de là (boutons de landing.tsx), mais À propos/
// Contact redeviennent accessibles SANS compte, comme sur le web.
export default function Index() {
  const status = useAuthStore((s) => s.status);
  return <Redirect href={status === "signedIn" ? "/(app)/schools" : "/(public)/landing"} />;
}
