import { Stack } from "expo-router";

// Groupe de routes "Bulletin" (itération 119) — même correctif que
// personnel/_layout.tsx et students/_layout.tsx. Un seul fichier
// (`[studentId].tsx`) dans ce dossier, mais SANS ce `_layout.tsx` sa route
// réelle est "bulletin/[studentId]", pas "bulletin" — ne correspond donc
// pas au `href: null` déclaré pour "bulletin" dans `[schoolId]/_layout.tsx`,
// et fuite comme onglet visible. Ce `_layout.tsx` la regroupe sous la
// route "bulletin" attendue.
export default function BulletinLayout() {
  return <Stack />;
}
