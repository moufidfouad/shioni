import { ActivityIndicator, ScrollView, Text } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useBulletinQuery } from "@/src/api/grades";
import { BulletinView } from "@/src/components/BulletinView";

// Détail du bulletin d'un élève, pour le personnel — atteint depuis le
// classement (notes.tsx). `trimestre` voyage en paramètre de route (passé
// explicitement par notes.tsx au `router.push`), pas re-choisi ici : on
// affiche le trimestre déjà sélectionné sur l'écran précédent, cohérent
// avec ce que l'utilisateur vient de consulter.
//
// Itération 98 — HUITIÈME écran migré vers NativeWind : `StyleSheet.
// create` → `className`, structure à 3 styles identique à `children/
// [studentId]/timetable.tsx` (itération 97), même conversion exacte.
// Écran trivial, aucune valeur conditionnelle. Non référencé par aucun
// flow Maestro (vérifié par grep avant de commencer).
export default function StaffBulletinScreen() {
  const { schoolId, studentId, trimestre } = useLocalSearchParams<{
    schoolId: string;
    studentId: string;
    trimestre: string;
  }>();
  const trimestreNumber = Number(trimestre) || 1;
  const { data: bulletin, isLoading, isError } = useBulletinQuery(schoolId, studentId, trimestreNumber);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: bulletin?.student.fullName ?? "Bulletin" }} />
      {isLoading ? (
        <ActivityIndicator />
      ) : isError ? (
        <Text className="mt-10 text-center text-[#c0392b]">Impossible de charger ce bulletin.</Text>
      ) : (
        <BulletinView bulletin={bulletin ?? null} />
      )}
    </ScrollView>
  );
}
