import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useChildSummaryQuery } from "@/src/api/parentPortal";
import { BulletinView } from "@/src/components/BulletinView";
import { TrimestrePicker } from "@/src/components/TrimestrePicker";
import { AttendanceList } from "@/src/components/AttendanceList";

// Résumé d'un enfant pour son parent — équivalent mobile de
// StudentSummaryPanel.tsx (web, monté dans ParentPortalPage.tsx). Combine
// bulletin + présences + frais de scolarité en un seul écran, exactement
// comme côté web (un compte Parent n'a qu'UNE page, pas un Tableau de bord
// séparé d'un écran Notes — voir dashboard.tsx::ParentDashboard, qui mène
// ici). 3 trimestres fixes pour le sélecteur, comme dashboard.tsx : GET
// /parameters (source de `nbTrimestres` réel) exige requireAnySchoolRole,
// qu'un compte Parent n'a jamais.
//
// Déplacé de children/[studentId].tsx vers children/[studentId]/index.tsx à
// l'itération 72 (Phase 2b), pour pouvoir ajouter un écran frère
// children/[studentId]/timetable.tsx (emploi du temps de CET enfant — pas
// de sens de le mettre ailleurs, l'emploi du temps d'un Parent est propre à
// chaque enfant). Historique de présence affiché en ENTIER désormais (plus
// de `.slice(0, 10)`) via le composant partagé AttendanceList — la donnée
// complète était déjà chargée par ce même appel (`summary.attendance`,
// listAllAttendance côté backend), aucun appel réseau supplémentaire.
//
// Itération 100 — DIXIÈME écran migré vers NativeWind : `StyleSheet.
// create` → `className`. Cas différent des badges conditionnels binaires
// vus aux itérations 95/96/98/99 (statut actif/inactif) : le statut de
// frais a TROIS valeurs (SOLDE/PARTIEL/impayé), donc `feeStatusStyle(status)`
// devient `feeStatusClassName(status)`, une fonction qui retourne la
// classe COMPLÈTE (taille + graisse + couleur) plutôt qu'une classe
// partielle à combiner — même principe qu'aux itérations précédentes
// (jamais empiler des classes `text-*` concurrentes), mais exprimé comme
// une fonction plutôt qu'un ternaire inline vu la troisième branche. Non
// référencé par aucun flow Maestro (vérifié avant de commencer).
export default function ChildSummaryScreen() {
  const { schoolId, studentId } = useLocalSearchParams<{ schoolId: string; studentId: string }>();
  const router = useRouter();
  const [trimestre, setTrimestre] = useState(1);
  const { data: summary, isLoading, isError } = useChildSummaryQuery(schoolId, studentId, trimestre);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16 }}>
      <Stack.Screen options={{ title: summary?.student.fullName ?? "Élève" }} />

      {isLoading ? (
        <ActivityIndicator />
      ) : isError || !summary ? (
        <Text className="mt-10 text-center text-[#c0392b]">Impossible de charger ce résumé.</Text>
      ) : (
        <>
          <Pressable
            className="rounded-lg bg-[#eef2ff] p-3"
            onPress={() =>
              router.push({
                pathname: "/(app)/schools/[schoolId]/children/[studentId]/timetable",
                params: { schoolId, studentId },
              })
            }
          >
            <Text className="font-semibold text-[#1d4ed8]">Voir l'emploi du temps →</Text>
          </Pressable>

          <Text className="mb-2 mt-5 text-base font-bold">Bulletin</Text>
          <TrimestrePicker value={trimestre} count={3} onChange={setTrimestre} />
          <BulletinView bulletin={summary.bulletin} />

          <Text className="mb-2 mt-5 text-base font-bold">Frais de scolarité</Text>
          {summary.enrollments.length === 0 ? (
            <Text className="mb-2 italic text-[#999]">Aucune inscription enregistrée.</Text>
          ) : (
            summary.enrollments.map((e) => (
              <View key={e.id} className="flex-row justify-between border-b border-b-[#eee] py-2">
                <Text className="text-sm">{e.schoolYear.label}</Text>
                <Text className={feeStatusClassName(e.status)}>{feeStatusLabel(e.status)}</Text>
              </View>
            ))
          )}

          <Text className="mb-2 mt-5 text-base font-bold">Présences</Text>
          <AttendanceList records={summary.attendance} />
        </>
      )}
    </ScrollView>
  );
}

function feeStatusLabel(status: string) {
  return status === "SOLDE" ? "Soldé" : status === "PARTIEL" ? "Partiel" : "Impayé";
}
function feeStatusClassName(status: string) {
  const color = status === "SOLDE" ? "text-[#16a34a]" : status === "PARTIEL" ? "text-[#d97706]" : "text-[#c0392b]";
  return `text-[13px] font-semibold ${color}`;
}
