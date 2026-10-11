import { ActivityIndicator, ScrollView, Text } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useChildTimetableQuery } from "@/src/api/parentPortal";
import { TimetableList } from "@/src/components/TimetableList";

// Emploi du temps d'un enfant, pour son parent — nouvel écran (itération
// 72, Phase 2b), atteint depuis children/[studentId]/index.tsx. Consomme
// le nouvel endpoint GET /parent/children/:studentId/timetable
// (parent-portal.routes.ts), ajouté pour cette phase : aucune route
// existante ne permettait à un compte Parent de lire l'emploi du temps
// d'un enfant (contrairement aux présences/bulletin/frais, déjà couverts
// par GET .../summary depuis l'itération 70).
//
// Itération 97 — SEPTIÈME écran migré vers NativeWind : `StyleSheet.
// create` → `className`, même convention qu'aux itérations précédentes.
// Écran trivial (3 styles, aucune valeur conditionnelle) — choisi après
// `timetable.tsx` (itération 96) car le plus petit fichier restant avec du
// style réel à migrer (les fichiers plus courts — `index.tsx`,
// `(auth)/_layout.tsx`, `messaging/_layout.tsx`, `(app)/_layout.tsx` — ne
// contiennent aucun `StyleSheet`, rien à migrer). Non référencé par aucun
// flow Maestro (vérifié par grep avant de commencer).
export default function ChildTimetableScreen() {
  const { schoolId, studentId } = useLocalSearchParams<{ schoolId: string; studentId: string }>();
  const { data: entries, isLoading, isError } = useChildTimetableQuery(schoolId, studentId);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: "Emploi du temps" }} />
      {isLoading ? (
        <ActivityIndicator />
      ) : isError || !entries ? (
        <Text className="mt-10 text-center text-[#c0392b]">Impossible de charger l'emploi du temps.</Text>
      ) : (
        <TimetableList entries={entries} />
      )}
    </ScrollView>
  );
}
