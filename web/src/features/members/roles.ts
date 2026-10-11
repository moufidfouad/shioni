import { SchoolRole } from "@/types";

export const ALL_ROLES: { value: SchoolRole; label: string }[] = [
  { value: "ADMIN", label: "Admin (paramètres & utilisateurs)" },
  { value: "GESTION_ELEVES", label: "Gestion des élèves" },
  { value: "GESTION_NOTES", label: "Gestion des notes" },
  { value: "GESTION_FINANCES", label: "Gestion des finances" },
  { value: "ENSEIGNANT", label: "Enseignant" },

  { value: "GESTION_RESSOURCES", label: "Gestion des ressources partagées" },
];
