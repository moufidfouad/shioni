import { Fragment } from "react";
import { NavLink } from "react-router-dom";
import {
  ChevronsLeft,
  ChevronsRight,
  LucideIcon,
  School as SchoolIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { schoolLogoUrl } from "@/features/schools/api";
import { useDialogFocusTrap } from "@/providers/hooks/useDialogFocusTrap";

// Sidebar de navigation d'une école (itération 26 — refonte UX/UI). Remplace
// la liste plate de <NavLink> écrite en dur dans SchoolLayout.tsx : ici la
// navigation est une donnée (`sections`), construite par SchoolLayout à
// partir du RBAC réel (canAccessRole) et des compteurs déjà disponibles côté
// Tableau de bord — pas de nouvelle requête réseau pour cette sidebar.
//
// Réductible sur desktop (icônes seules, `title` HTML natif en repli pour le
// libellé — pas de nouvelle primitive Tooltip ajoutée pour ce seul besoin) ;
// devient un panneau plein écran sur mobile (voir section 29 de la demande :
// "sur mobile, la sidebar doit devenir un menu adapté", pas juste rétrécie).
export interface SidebarNavItem {
  to: string;
  end?: boolean;
  label: string;
  icon: LucideIcon;
  /** Compteur optionnel affiché à droite du libellé (ex: nb d'élèves, nb d'impayés). */
  count?: number;
}

export interface SidebarNavSection {
  title: string;
  items: SidebarNavItem[];
}

interface SidebarProps {
  schoolId: string;
  schoolName: string;

  hasLogo?: boolean;
  sections: SidebarNavSection[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}


function SchoolLogo({
  schoolId,
  hasLogo,
  collapsed,
}: {
  schoolId: string;
  hasLogo?: boolean;
  collapsed: boolean;
}) {
  const size = collapsed ? "size-8" : "size-9";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted",
        size,
      )}
    >
      {hasLogo ? (
        <img
          src={schoolLogoUrl(schoolId)}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <SchoolIcon className="size-4 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}

function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: SidebarNavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="truncate">{item.label}</span>
          {typeof item.count === "number" && item.count > 0 && (
            <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {item.count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function SidebarNav({
  sections,
  collapsed,
  onNavigate,
}: {
  sections: SidebarNavSection[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
      {sections.map((section) => (
        <Fragment key={section.title}>
          {section.items.length > 0 && (
            <div>
              {!collapsed && (
                <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <SidebarLink
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

export default function Sidebar({
  schoolId,
  schoolName,
  hasLogo,
  sections,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {

  const mobilePanelRef = useDialogFocusTrap<HTMLElement>(
    mobileOpen,
    onCloseMobile,
  );

  return (
    <>
      {/* Desktop : colonne réductible, toujours visible à partir de md. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-card transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center gap-2.5 border-b px-3",
            collapsed && "justify-center px-0",
          )}
        >
          <SchoolLogo
            schoolId={schoolId}
            hasLogo={hasLogo}
            collapsed={collapsed}
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                École
              </p>
              <p className="truncate text-sm font-semibold">{schoolName}</p>
            </div>
          )}
        </div>

        <SidebarNav sections={sections} collapsed={collapsed} />

        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex h-11 items-center justify-center gap-2 border-t text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title={
            collapsed
              ? "Déplier la barre latérale"
              : "Réduire la barre latérale"
          }
          aria-label={
            collapsed
              ? "Déplier la barre latérale"
              : "Réduire la barre latérale"
          }
        >
          {collapsed ? (
            <ChevronsRight className="size-4" />
          ) : (
            <>
              <ChevronsLeft className="size-4" /> Réduire
            </>
          )}
        </button>
      </aside>

      {/* Mobile : panneau plein écran, pas une simple version rétrécie du desktop. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-black/40"
            onClick={onCloseMobile}
          />
          <aside
            ref={mobilePanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navigation"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-card shadow-xl"
          >
            <div className="flex h-14 items-center justify-between gap-2.5 border-b px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <SchoolLogo
                  schoolId={schoolId}
                  hasLogo={hasLogo}
                  collapsed={false}
                />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    École
                  </p>
                  <p className="truncate text-sm font-semibold">{schoolName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                className="rounded-md p-1.5 hover:bg-accent"
                aria-label="Fermer"
              >
                <X className="size-5" />
              </button>
            </div>
            <SidebarNav
              sections={sections}
              collapsed={false}
              onNavigate={onCloseMobile}
            />
          </aside>
        </div>
      )}
    </>
  );
}
