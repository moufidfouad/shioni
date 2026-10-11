import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/contexts/AuthContext/context";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b bg-card px-6 py-3">
      <Link to="/schools" className="text-lg font-semibold text-primary">
        🏫 SHIONI
      </Link>
      {user && (
        <div className="flex items-center gap-4 text-sm">
          {user.isSuperAdmin && (
            <>
              <Badge>Superadmin</Badge>
              {/* Itération 63 — gestion des témoignages de la landing page +
                  consultation des messages de contact, réservée au
                  superadmin (voir PublicContentPage.tsx). */}
              <Link to="/admin/content" className="text-muted-foreground hover:text-foreground">
                Contenu public
              </Link>
              {/* Itération 67 — statistiques globales (toutes écoles), même
                  cadrage superadmin que le lien ci-dessus. */}
              <Link to="/admin/stats" className="text-muted-foreground hover:text-foreground">
                Statistiques globales
              </Link>
            </>
          )}
          <Link to="/account" className="text-muted-foreground hover:text-foreground">
            {user.fullName}
          </Link>
          <Button variant="ghost" size="sm" onClick={logout}>
            Déconnexion
          </Button>
        </div>
      )}
    </header>
  );
}
