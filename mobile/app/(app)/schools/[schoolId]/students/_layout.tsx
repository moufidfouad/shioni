import { Stack } from "expo-router";

// Groupe de routes "Élèves" (itération 119) — même correctif et même
// raison que personnel/_layout.tsx : regroupe `index.tsx` et
// `[studentId].tsx` sous UNE seule route "students", pour que `href: null`
// (déclaré dans `[schoolId]/_layout.tsx`) la masque bien de la barre
// d'onglets au lieu de laisser fuiter les deux fichiers comme onglets
// séparés.
export default function StudentsLayout() {
  return <Stack />;
}
