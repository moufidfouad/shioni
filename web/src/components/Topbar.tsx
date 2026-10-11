import { Link } from "react-router-dom";
import { ChevronRight, Menu } from "lucide-react";
import { useAuth } from "../providers/contexts/AuthContext/context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";


export default function Topbar({
  schoolName,
  sectionLabel,
  onOpenMobileMenu,
}: {
  schoolName: string;
  sectionLabel?: string;
  onOpenMobileMenu: () => void;
}) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-card px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="size-5" />
        </button>

        <nav aria-label="Fil d'Ariane" className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link to="/schools" className="shrink-0 text-muted-foreground hover:text-foreground">
            Mes écoles
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
          <span className="truncate font-medium text-foreground">{schoolName}</span>
          {sectionLabel && (
            <>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
              <span className="truncate text-muted-foreground">{sectionLabel}</span>
            </>
          )}
        </nav>
      </div>

      {user && (
        <div className="flex shrink-0 items-center gap-3 text-sm">
          {user.isSuperAdmin && <Badge className="hidden sm:inline-flex">Superadmin</Badge>}
          <Link to="/account" className="hidden text-muted-foreground hover:text-foreground sm:inline">
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
