import { Stack } from "expo-router";

// Groupe de routes "Personnel" (itération 119) — même patron que
// messaging/_layout.tsx (itération 74) : SANS ce fichier, Expo Router
// traite `index.tsx` et `[staffId].tsx` comme deux routes DISTINCTES au
// niveau du Tabs parent (`[schoolId]/_layout.tsx`), qui ne correspondent
// alors PLUS au nom "personnel" déclaré là-bas avec `href: null` — chacune
// apparaît donc comme un onglet à part, visible et non désiré, dans la
// barre d'onglets (bug découvert à l'itération 119, jamais visible avant
// faute de vérification sur appareil réel). Ce `_layout.tsx` regroupe les
// deux fichiers sous UNE seule route "personnel", qui correspond bien à
// `href: null` et reste donc masquée de la barre tout en restant
// naviguable normalement (liste → fiche, comme avant).
export default function PersonnelLayout() {
  return <Stack />;
}
