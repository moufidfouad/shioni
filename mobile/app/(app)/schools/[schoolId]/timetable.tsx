import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSchoolQuery } from "@/src/api/schools";
import { useSchoolParametersQuery } from "@/src/api/parameters";
import { useTimetableQuery } from "@/src/api/timetable";
import { useMyTimetableQuery } from "@/src/api/studentPortal";
import { TimetableList } from "@/src/components/TimetableList";
import { useAuthStore } from "@/src/store/authStore";

// Écran "Emploi du temps" — Phase 2b du plan mobile. Accessible depuis le
// Tableau de bord pour le personnel ET l'élève (voir dashboard.tsx), avec
// un rendu différent selon le profil déterminé ICI, sur la base de
// `school.myRoles`/`isStudent` — même patron d'aiguillage qu'un seul
// fichier que dashboard.tsx (itération 70), plutôt que deux routes
// distinctes pour un contenu dont seul le SÉLECTEUR change (le personnel
// choisit une classe, un élève voit directement la sienne). L'emploi du
// temps d'un Parent, lui, est propre à CHAQUE enfant et vit sous
// children/[studentId]/timetable.tsx — pas de branche Parent ici : un
// compte Parent n'a aucune raison d'atteindre cette route (aucun lien vers
// elle depuis ParentDashboard).
//
// Itération 96 — SIXIÈME écran migré vers NativeWind : `StyleSheet.create`
// → `className`, même convention qu'aux itérations précédentes. Même point
// de vigilance qu'à l'itération 95 (`personnel/index.tsx`) pour le style
// conditionnel de la pastille de classe sélectionnée (`[styles.classPill,
// cond && styles.classPillActive]`) : une seule classe de fond/texte
// choisie explicitement par branche, jamais deux classes `bg-*`/`text-*`
// empilées dont l'ordre de cascade Tailwind ne serait pas garanti. Non
// référencé par aucun flow Maestro (vérifié par grep avant de commencer).
export default function TimetableScreen() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  const { data: school, isLoading, isError } = useSchoolQuery(schoolId);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <ActivityIndicator />
      </View>
    );
  }
  if (isError || !school) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-center text-[#c0392b]">Impossible de charger cette école.</Text>
      </View>
    );
  }

  // Itération 118 — même correctif superadmin que dashboard.tsx/_layout.tsx.
  const isSuperAdmin = Boolean(useAuthStore((s) => s.user)?.isSuperAdmin);
  const isStaff = Boolean(school.myRoles && school.myRoles.length > 0) || isSuperAdmin;

  return (
    <>
      <Stack.Screen options={{ title: "Emploi du temps" }} />
      {isStaff ? (
        <StaffTimetable schoolId={schoolId} />
      ) : school.isStudent ? (
        <StudentTimetable schoolId={schoolId} />
      ) : (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-center text-[#c0392b]">
            Consultez l'emploi du temps depuis la fiche de chaque enfant.
          </Text>
        </View>
      )}
    </>
  );
}

function StaffTimetable({ schoolId }: { schoolId: string }) {
  const { data: params, isLoading: loadingParams } = useSchoolParametersQuery(schoolId);
  const [groupeId, setGroupeId] = useState<string | undefined>(undefined);

  const groupeOptions = useMemo(() => {
    if (!params) return [];
    const classeById = new Map(params.classes.map((c) => [c.id, c]));
    return params.groupes
      .map((g) => ({ id: g.id, label: `${classeById.get(g.classeId)?.name ?? "?"} — ${g.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [params]);

  const { data: entries, isLoading: loadingEntries, isError } = useTimetableQuery(schoolId, groupeId);

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-3">
        {loadingParams ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            horizontal
            data={groupeOptions}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = item.id === groupeId;
              return (
                <Pressable
                  onPress={() => setGroupeId(item.id)}
                  className={`mr-2 rounded-2xl px-3 py-[6px] ${isSelected ? "bg-[#1d4ed8]" : "bg-[#f0f0f0]"}`}
                >
                  <Text className={`text-[13px] ${isSelected ? "font-semibold text-white" : "text-[#333]"}`}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text className="mt-4 text-center text-[#999]">Aucune classe configurée.</Text>}
          />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {!groupeId ? (
          <Text className="mt-8 text-center text-[#999]">Choisissez une classe pour voir son emploi du temps.</Text>
        ) : loadingEntries ? (
          <ActivityIndicator className="mt-6" />
        ) : isError || !entries ? (
          <Text className="mt-8 text-center text-[#c0392b]">Impossible de charger l'emploi du temps.</Text>
        ) : (
          <TimetableList entries={entries} />
        )}
      </ScrollView>
    </View>
  );
}

function StudentTimetable({ schoolId }: { schoolId: string }) {
  const { data: entries, isLoading, isError } = useMyTimetableQuery(schoolId);

  if (isLoading) return <ActivityIndicator className="mt-10" />;
  if (isError || !entries) return <Text className="mt-8 text-center text-[#c0392b]">Impossible de charger votre emploi du temps.</Text>;

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16 }}>
      <TimetableList entries={entries} />
    </ScrollView>
  );
}
