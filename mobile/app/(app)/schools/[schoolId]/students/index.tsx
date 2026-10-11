import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSchoolParametersQuery } from "@/src/api/parameters";
import { studentPhotoUrl, useStudentsQuery } from "@/src/api/students";
import { AuthenticatedPhoto } from "@/src/components/AuthenticatedPhoto";
import { Student } from "@/src/types";

const SEARCH_DEBOUNCE_MS = 400;

// Itération 88 — `undefined` = "Tous" (pas de filtre envoyé), jamais une
// valeur d'enum côté serveur (voir Sex, schema.prisma : seuls M/F existent).
const SEX_OPTIONS: { value: "M" | "F" | undefined; label: string }[] = [
  { value: undefined, label: "Tous" },
  { value: "M", label: "Garçons" },
  { value: "F", label: "Filles" },
];

// Écran "Élèves" (Phase 2d, itération 75) — PERSONNEL uniquement (voir
// dashboard.tsx::StaffDashboard, seul point d'entrée). LECTURE SEULE :
// aucune création/modification/suppression depuis mobile, même choix que
// Notes/Présences/Emploi du temps. Portée Enseignant appliquée
// SERVEUR-SIDE (resolveTeacherScope, students.controller.ts) — un compte
// ENSEIGNANT reçoit déjà, sans rien de spécial ici, la liste restreinte à
// ses seules classes.
//
// Pagination RÉELLE page/pageSize (voir Paginated<T>, src/types/index.ts) —
// PREMIÈRE utilisation mobile de ce contrat, via `useInfiniteQuery` comme
// recommandé par le plan mobile (section 2.3) : chargement d'une page à la
// fois au défilement (`onEndReached`), jamais `?all=true` (réservé aux
// sélecteurs internes du web).
//
// Itération 103 — TREIZIÈME écran migré vers NativeWind : `StyleSheet.
// create` → `className`. Deux pastilles conditionnelles réutilisent le
// même patron déjà vu à l'itération 96 (`timetable.tsx`) : une seule classe
// de fond/texte choisie explicitement par branche, jamais deux classes
// empilées. Couvert par `students-browse.yaml` (Maestro), relu avant de
// commencer : assertion sur le placeholder "Rechercher un élève…" et taps
// sur "Filles"/"Tous" — aucun de ces textes ne change ici, seul le style.
export default function StudentsScreen() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  const router = useRouter();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [groupeId, setGroupeId] = useState<string | undefined>(undefined);
  // Itération 88 — parité avec le filtre "sexe" de StudentsPage.tsx (web,
  // voir le commentaire de StudentFilters dans src/api/students.ts) :
  // `undefined` = "Tous", pas une 3e valeur d'enum côté serveur.
  const [sex, setSex] = useState<"M" | "F" | undefined>(undefined);

  // Anti-rebond de la recherche texte — même délai que le "typing:stop" de
  // la Messagerie (src/lib/messagingSocket.tsx), pour ne pas relancer une
  // requête à chaque frappe.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim() || undefined), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: params, isLoading: loadingParams } = useSchoolParametersQuery(schoolId);
  const groupeOptions = useMemo(() => {
    if (!params) return [];
    const classeById = new Map(params.classes.map((c) => [c.id, c]));
    return params.groupes
      .map((g) => ({ id: g.id, label: `${classeById.get(g.classeId)?.name ?? "?"} — ${g.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [params]);

  const studentsQuery = useStudentsQuery(schoolId, { search, groupeId, sex });
  const students = useMemo(() => studentsQuery.data?.pages.flatMap((p) => p.data) ?? [], [studentsQuery.data]);
  const total = studentsQuery.data?.pages[0]?.pagination.total;

  function renderItem({ item }: { item: Student }) {
    return (
      <Pressable
        className="mb-2 flex-row items-center rounded-[10px] bg-[#f5f7fa] p-3"
        onPress={() =>
          router.push({ pathname: "/(app)/schools/[schoolId]/students/[studentId]", params: { schoolId, studentId: item.id } })
        }
      >
        <AuthenticatedPhoto uri={studentPhotoUrl(schoolId, item.id)} hasPhoto={item.hasPhoto} fullName={item.fullName} />
        <View className="ml-3 flex-1">
          <Text className="text-[15px] font-semibold">{item.fullName}</Text>
          <Text className="mt-[2px] text-xs text-[#888]">
            {item.matricule}
            {item.groupe ? ` · ${item.groupe.name}` : ""}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: "Élèves" }} />

      <View className="px-4 pt-3">
        <TextInput
          className="rounded-lg border border-[#d0d0d0] px-3 py-2 text-[15px]"
          placeholder="Rechercher un élève…"
          value={searchInput}
          onChangeText={setSearchInput}
          autoCapitalize="none"
        />
        {loadingParams ? (
          <ActivityIndicator className="mt-2" />
        ) : (
          <FlatList
            horizontal
            data={groupeOptions}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            className="mt-2"
            renderItem={({ item }) => {
              const isSelected = item.id === groupeId;
              return (
                <Pressable
                  onPress={() => setGroupeId((current) => (current === item.id ? undefined : item.id))}
                  className={`mr-2 rounded-2xl px-3 py-[6px] ${isSelected ? "bg-[#1d4ed8]" : "bg-[#f0f0f0]"}`}
                >
                  <Text className={`text-[13px] ${isSelected ? "font-semibold text-white" : "text-[#333]"}`}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}

        {/* Itération 88 — filtre sexe, parité avec StudentsPage.tsx (web).
            3 pills statiques (pas de FlatList, contrairement aux classes
            ci-dessus qui dépendent des données de l'école) — même style que
            la pastille de classe pour rester visuellement cohérent. */}
        <View className="mt-2 flex-row">
          {SEX_OPTIONS.map((option) => {
            const isSelected = sex === option.value;
            return (
              <Pressable
                key={option.value ?? "all"}
                onPress={() => setSex(option.value)}
                className={`mr-2 rounded-2xl px-3 py-[6px] ${isSelected ? "bg-[#1d4ed8]" : "bg-[#f0f0f0]"}`}
              >
                <Text className={`text-[13px] ${isSelected ? "font-semibold text-white" : "text-[#333]"}`}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {total != null && <Text className="mt-2 text-xs text-[#888]">{total} élève{total > 1 ? "s" : ""}</Text>}
      </View>

      {studentsQuery.isLoading ? (
        <ActivityIndicator className="mt-6" />
      ) : studentsQuery.isError ? (
        <Text className="mt-8 text-center text-[#c0392b]">Impossible de charger la liste des élèves.</Text>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={renderItem}
          onEndReached={() => {
            if (studentsQuery.hasNextPage && !studentsQuery.isFetchingNextPage) studentsQuery.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={studentsQuery.isFetchingNextPage ? <ActivityIndicator className="my-3" /> : null}
          ListEmptyComponent={<Text className="mt-4 text-center text-[#999]">Aucun élève trouvé.</Text>}
        />
      )}
    </View>
  );
}
