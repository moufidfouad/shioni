import { ReactNode } from "react";
import { SchoolRole } from "../types";

// Prédicat pur, réutilisé par le composant RoleGate ci-dessous et par la
// construction de la navigation (Sidebar.tsx, itération 26) : superadmin OU
// au moins un des rôles listés dans `roles` pour l'école courante. Un seul
// endroit qui décide "cet utilisateur peut-il voir ceci", que ce soit pour
// masquer un bouton (RoleGate) ou une entrée de sidebar entière.
export function canAccessRole(roles: SchoolRole[], myRoles: SchoolRole[], isSuperAdmin: boolean): boolean {
  return isSuperAdmin || myRoles.some((r) => roles.includes(r));
}

// Affiche `children` seulement si l'utilisateur est superadmin OU possède
// au moins un des rôles listés dans `roles` pour l'école courante.
// C'est la contrepartie côté UI du middleware requireSchoolRole côté API :
// ça évite d'afficher des boutons/actions que l'utilisateur n'a pas le
// droit d'utiliser (le vrai contrôle d'accès reste fait par l'API).
export default function RoleGate({
  roles,
  myRoles,
  isSuperAdmin,
  children,
  fallback = null,
}: {
  roles: SchoolRole[];
  myRoles: SchoolRole[];
  isSuperAdmin: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const allowed = canAccessRole(roles, myRoles, isSuperAdmin);
  return <>{allowed ? children : fallback}</>;
}
