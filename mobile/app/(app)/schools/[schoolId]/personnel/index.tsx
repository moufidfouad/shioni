import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { staffPhotoUrl, useStaffQuery } from "@/src/api/personnel";
import { AuthenticatedPhoto } from "@/src/components/AuthenticatedPhoto";
import { StaffMember } from "@/src/types";

const SEARCH_DEBOUNCE_MS = 400;

// Écran "Personnel" (Phase 2d, itération 75) — ADMIN UNIQUEMENT, dans les
// deux sens (personnel.routes.ts : `requireSchoolRole(ADMIN)` posé avant
// TOUT le routeur, lecture comprise — fiche contenant `salaireBrut`, aucun
// rôle `GESTION_PERSONNEL` dédié). Le lien vers cet écran n'apparaît côté
// StaffDashboard (dashboard.tsx) QUE si `school.myRoles` contient `ADMIN` —
// mais on reste défensif ici aussi (navigation directe par URL toujours
// possible en théorie) : un compte non-ADMIN qui arriverait quand même sur
// cet écran verrait simplement l'erreur de chargement (403 → isError),
// jamais de fuite de données. LECTURE SEULE, comme Élèves.
//
// `statut` reste un champ texte libre côté backend (pas d'enum Prisma, voir
// personnel.schema.ts) — plutôt que de deviner un jeu de valeurs fermé,
// simple bascule "Actifs seulement" (statut=Actif, la valeur par défaut
// posée à la création) au lieu d'un sélecteur à choix multiples.
//
// Itération 95 — CINQUIÈME écran migré vers NativeWind : `StyleSheet.
// create` → `className`, même convention qu'aux itérations précédentes.
// Les styles conditionnels d'origine (`[styles.x, cond && styles.y]`, un
// tableau où le second style GAGNE quand la condition est vraie) deviennent
// un template littéral choisissant explicitement UNE seule classe de fond/
// texte par branche plutôt que d'empiler deux classes `bg-*`/`text-*`
// arbitraires côte à côte — leur ordre dans la chaîne `className` ne
// garantit PAS la même sémantique de cascade CSS que l'ordre d'un tableau
// `style` React Native (source de vérité : `StyleSheet.flatten`, qui
// fusionne objet par objet dans l'ordre, contre une feuille de style
// Tailwind dont l'ordre des règles dépend de l'ordre de GÉNÉRATION, pas de
// l'ordre d'apparition dans `className`) — donc reproduire EXACTEMENT le
// même résultat visuel (jamais une approximation) en évitant toute
// ambiguïté plutôt qu'en supposant que ça fonctionnerait.
export default function PersonnelScreen() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  const router = useRouter();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [activeOnly, setActiveOnly] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim() || undefined), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters = useMemo(() => ({ search, statut: activeOnly ? "Actif" : undefined }), [search, activeOnly]);
  const staffQuery = useStaffQuery(schoolId, filters);
  const staff = useMemo(() => staffQuery.data?.pages.flatMap((p) => p.data) ?? [], [staffQuery.data]);
  const total = staffQuery.data?.pages[0]?.pagination.total;

  function renderItem({ item }: { item: StaffMember }) {
    const isActive = item.statut === "Actif";
    return (
      <Pressable
        className="mb-2 flex-row items-center rounded-[10px] bg-[#f5f7fa] p-3"
        onPress={() =>
          router.push({ pathname: "/(app)/schools/[schoolId]/personnel/[staffId]", params: { schoolId, staffId: item.id } })
        }
      >
        <AuthenticatedPhoto uri={staffPhotoUrl(schoolId, item.id)} hasPhoto={item.hasPhoto} fullName={item.fullName} />
        <View className="ml-3 flex-1">
          <Text className="text-[15px] font-semibold">{item.fullName}</Text>
          <Text className="mt-[2px] text-xs text-[#888]">{item.fonction || "Fonction non renseignée"}</Text>
        </View>
        <View className={`rounded-[10px] px-2 py-[3px] ${isActive ? "bg-[#dcfce7]" : "bg-[#eee]"}`}>
          <Text className={`text-[11px] ${isActive ? "font-semibold text-[#16a34a]" : "text-[#666]"}`}>{item.statut}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: "Personnel" }} />

      <View className="px-4 pt-3">
        <TextInput
          className="rounded-lg border border-[#d0d0d0] px-3 py-2 text-[15px]"
          placeholder="Rechercher un membre du personnel…"
          value={searchInput}
          onChangeText={setSearchInput}
          autoCapitalize="none"
        />
        <Pressable className="mt-[10px] flex-row items-center" onPress={() => setActiveOnly((v) => !v)}>
          <View
            className={`mr-2 h-[18px] w-[18px] rounded border ${activeOnly ? "border-[#1d4ed8] bg-[#1d4ed8]" : "border-[#bbb]"}`}
          />
          <Text className="text-[13px] text-[#444]">Actifs seulement</Text>
        </Pressable>
        {total != null && <Text className="mt-2 text-xs text-[#888]">{total} membre{total > 1 ? "s" : ""} du personnel</Text>}
      </View>

      {staffQuery.isLoading ? (
        <ActivityIndicator className="mt-6" />
      ) : staffQuery.isError ? (
        <Text className="mt-8 text-center text-[#c0392b]">Impossible de charger la liste du personnel.</Text>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={renderItem}
          onEndReached={() => {
            if (staffQuery.hasNextPage && !staffQuery.isFetchingNextPage) staffQuery.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={staffQuery.isFetchingNextPage ? <ActivityIndicator className="my-3" /> : null}
          ListEmptyComponent={<Text className="mt-4 text-center text-[#999]">Aucun membre du personnel trouvé.</Text>}
        />
      )}
    </View>
  );
}
