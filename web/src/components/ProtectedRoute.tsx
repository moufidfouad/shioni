import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/contexts/AuthContext/context";
import PageLoader from "./PageLoader";

// Bloque l'accès aux routes enfants tant que l'utilisateur n'est pas
// authentifié ; redirige vers /login sinon. `PageLoader` (itération 21)
// remplace l'ancien texte brut "Chargement…" — un seul indicateur de
// chargement pour toute l'application, y compris le <Suspense> d'App.tsx.
export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
