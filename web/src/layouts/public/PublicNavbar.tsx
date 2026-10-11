import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDialogFocusTrap } from "@/providers/hooks/useDialogFocusTrap";

const links = [
  { to: "/", label: "Accueil" },
  { to: "/ressources", label: "Ressources" },
  { to: "/about", label: "À propos" },
  { to: "/contact", label: "Contact" },
];

export default function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useDialogFocusTrap<HTMLElement>(mobileOpen, () =>
    setMobileOpen(false),
  );

  return (
    <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
      <div
        aria-hidden="true"
        className="h-1 bg-linear-to-r from-primary via-info to-success"
      />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-lg font-semibold text-primary">
          🏫 SHIONI
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground sm:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative rounded-full px-3 py-1.5 transition-colors",
                  isActive ? "text-primary" : "hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="public-nav-active-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-primary/10"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  )}
                  {l.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Connexion</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/register">Créer un compte</Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navigation"
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-card shadow-xl"
          >
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="text-sm font-semibold text-primary">
                🏫 SHIONI
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 hover:bg-accent"
                aria-label="Fermer"
              >
                <X className="size-5" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3 text-sm font-medium">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "rounded-md px-3 py-2",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>

            <div className="space-y-2 border-t p-3">
              <Button
                asChild
                variant="outline"
                className="w-full"
                onClick={() => setMobileOpen(false)}
              >
                <Link to="/login">Connexion</Link>
              </Button>
              <Button
                asChild
                className="w-full"
                onClick={() => setMobileOpen(false)}
              >
                <Link to="/register">Créer un compte</Link>
              </Button>
            </div>
          </aside>
        </div>
      )}
    </header>
  );
}
