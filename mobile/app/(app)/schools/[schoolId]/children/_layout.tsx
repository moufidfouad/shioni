import { Stack } from "expo-router";

// Groupe de routes "Mes enfants" (Portail Parent, itération 119) — même
// correctif que personnel/_layout.tsx/students/_layout.tsx/
// bulletin/_layout.tsx, à un niveau de plus (`children/[studentId]/
// index.tsx` et `children/[studentId]/timetable.tsx`) : même patron déjà
// éprouvé par messaging/_layout.tsx (itération 74), qui regroupe lui aussi
// avec succès un niveau de nesting supplémentaire (`[conversationId]/...`)
// sous la seule route "messaging" — ce fichier fait de même pour
// "children", pour qu'elle corresponde au `href: null` déclaré dans
// `[schoolId]/_layout.tsx` au lieu de fuiter comme onglet(s) visible(s).
export default function ChildrenLayout() {
  return <Stack />;
}
