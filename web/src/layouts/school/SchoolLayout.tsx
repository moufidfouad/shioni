import { useMemo, useState } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  CalendarCheck,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  Milestone,
  Network,
  Receipt,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { SchoolRole, School } from "@/types";
import { useSchoolQuery, useSchoolsQuery } from "@/features/schools/api";
import { useDashboardQuery } from "@/features/dashboard/api";
import { useConversationsQuery } from "@/features/messaging/api";
import { canAccessRole } from "@/components/RoleGate";
import Sidebar, { SidebarNavSection } from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import PageLoader from "@/components/PageLoader";
import { useLocalStorageBoolean } from "@/providers/hooks/useLocalStorage";
import { useAuth } from "@/providers/contexts/AuthContext/context";

export interface SchoolOutletContext {
  school: School;
  myRoles: SchoolRole[];
  isSuperAdmin: boolean;
}

const SIDEBAR_COLLAPSED_KEY = "sm_sidebar_collapsed";

// Coquille commune à toutes les pages d'une école
export default function SchoolLayout() {
  const { schoolId } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const schoolQuery = useSchoolQuery(schoolId);
  const schoolsListQuery = useSchoolsQuery();

  const membership = schoolsListQuery.data?.find((s) => s.id === schoolId);
  const myRoles = membership?.myRoles || [];
  const isSuperAdmin = Boolean(user?.isSuperAdmin);

  const isGuardianOnly = Boolean(membership?.isGuardian) && myRoles.length === 0 && !isSuperAdmin;

  const isStudentOnly =
    Boolean(membership?.isStudent) && myRoles.length === 0 && !isSuperAdmin && !isGuardianOnly;

    
  const dashboardQuery = useDashboardQuery(
    schoolId ?? "",
    undefined,
    schoolsListQuery.isSuccess && !isGuardianOnly && !isStudentOnly
  );

  const conversationsQuery = useConversationsQuery(schoolId ?? "", Boolean(schoolId));
  const unreadMessagesCount = (conversationsQuery.data ?? []).reduce((sum, c) => sum + c.unreadCount, 0);


  const [collapsed, setCollapsed] = useLocalStorageBoolean(SIDEBAR_COLLAPSED_KEY, false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const school = schoolQuery.data ?? null;
  const loading = schoolQuery.isLoading || schoolsListQuery.isLoading;
  const dashboard = dashboardQuery.data ?? null;

  function toggleCollapsed() {
    setCollapsed((prev) => !prev);
  }

  const can = (roles: SchoolRole[]) => canAccessRole(roles, myRoles, isSuperAdmin);

  // Section "Tableau de bord" toujours visible (lecture ouverte à tout
  // membre) ; les autres reprennent EXACTEMENT les mêmes exigences de rôle
  // que l'ancienne navigation (aucun changement de permission, uniquement de
  // présentation) — voir "Ce qui n'a volontairement pas changé" dans le
  // README pour le détail.
  const sections: SidebarNavSection[] = useMemo(() => {

    if (isGuardianOnly) {
      return [
        {
          title: "Mon espace",
          items: [
            { to: "parent", end: true, label: "Mes enfants", icon: Users },

            { to: "messages", label: "Messagerie", icon: MessageCircle, count: unreadMessagesCount || undefined },
          ],
        },
      ];
    }

    if (isStudentOnly) {
      return [
        {
          title: "Mon espace",
          items: [
            { to: "student", end: true, label: "Mes résultats", icon: GraduationCap },
            { to: "messages", label: "Messagerie", icon: MessageCircle, count: unreadMessagesCount || undefined },
          ],
        },
      ];
    }

    const items = (roles: SchoolRole[], list: SidebarNavSection["items"]) => (can(roles) ? list : []);
    return [
      {
        title: "Tableau de bord",
        items: [
          { to: "", end: true, label: "Vue d'ensemble", icon: LayoutDashboard },

          { to: "analytics", label: "Analyse pédagogique", icon: BarChart3 },

          { to: "messages", label: "Messagerie", icon: MessageCircle, count: unreadMessagesCount || undefined },
        ],
      },
      {
        title: "Scolarité",
        items: [

          ...items(["ADMIN", "GESTION_ELEVES", "ENSEIGNANT"], [
            { to: "students", label: "Élèves", icon: Users, count: dashboard?.students.total },
          ]),
          ...items(["ADMIN", "GESTION_FINANCES"], [
            { to: "enrollments", label: "Inscriptions & frais", icon: Wallet, count: dashboard?.enrollments.impaye },
          ]),

          ...items(["ADMIN", "GESTION_FINANCES"], [{ to: "tuition-fees", label: "Écolage", icon: Receipt }]),

          ...items(["ADMIN", "GESTION_ELEVES"], [
            { to: "student-network", label: "Recherche inter-établissements", icon: Search },
          ]),
        ],
      },
      {
        title: "Pédagogie",
        items: [

          ...items(["ADMIN", "GESTION_ELEVES", "ENSEIGNANT"], [
            { to: "attendance", label: "Présences", icon: CalendarCheck },
          ]),
          ...items(["ADMIN", "GESTION_NOTES", "ENSEIGNANT"], [
            { to: "grades", label: "Notes & bulletins", icon: GraduationCap },
          ]),
          ...items(["ADMIN"], [{ to: "subjects", label: "Matières & coefficients", icon: BookOpen }]),
          ...items(["ADMIN", "ENSEIGNANT"], [
            { to: "timetable", label: "Emploi du temps", icon: CalendarClock },
          ]),

          ...items(["ADMIN", "GESTION_RESSOURCES", "ENSEIGNANT"], [
            { to: "resources", label: "Ressources partagées", icon: Share2 },
          ]),

          ...items(["ADMIN", "GESTION_ELEVES"], [
            { to: "end-of-year", label: "Décisions de fin d'année", icon: Milestone },
          ]),
        ],
      },
      {
        title: "Personnel",
        items: items(["ADMIN"], [{ to: "personnel", label: "Personnel", icon: UserCog }]),
      },
      {
        title: "Finances",
        items: items(["ADMIN", "GESTION_FINANCES"], [
          { to: "finances", label: "Finances", icon: Landmark },

          { to: "payment-tracking", label: "Suivi des paiements", icon: ListChecks },
        ]),
      },
      {
        title: "Administration",
        items: items(["ADMIN"], [

          { to: "structure", label: "Structure pédagogique", icon: Network },
          { to: "settings", label: "Paramètres", icon: Settings },
          { to: "members", label: "Utilisateurs & rôles", icon: ShieldCheck },
        ]),
      },
    ];
  }, [myRoles, isSuperAdmin, isGuardianOnly, isStudentOnly, dashboard, unreadMessagesCount]);

  // Libellé de section pour le fil d'Ariane de la Topbar : on retrouve
  // l'item de navigation dont le chemin correspond à l'URL courante plutôt
  // que de dupliquer une seconde table de correspondance route → libellé.
  const sectionLabel = useMemo(() => {
    for (const section of sections) {
      for (const item of section.items) {
        if (!item.to) continue;
        if (location.pathname.endsWith(`/${item.to}`)) return item.label;
      }
    }
    return undefined;
  }, [sections, location.pathname]);


  const outletContext = useMemo<SchoolOutletContext | null>(
    () => (school ? { school, myRoles, isSuperAdmin } : null),
    [school, myRoles, isSuperAdmin]
  );

  if (loading || !school || !outletContext) {
    return <PageLoader />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        schoolId={school.id}
        schoolName={school.name}
        hasLogo={school.hasLogo}
        sections={sections}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar schoolName={school.name} sectionLabel={sectionLabel} onOpenMobileMenu={() => setMobileOpen(true)} />

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {isGuardianOnly && location.pathname === `/schools/${schoolId}` ? (
            // Un compte Parent n'a pas de "Vue d'ensemble" : on l'envoie
            // directement sur son unique page plutôt que sur
            // SchoolOverviewPage (qui appellerait /dashboard, hors d'accès).
            <Navigate to="parent" replace />
          ) : isStudentOnly && location.pathname === `/schools/${schoolId}` ? (

            <Navigate to="student" replace />
          ) : (
            <Outlet context={outletContext} />
          )}
        </main>
      </div>
    </div>
  );
}
