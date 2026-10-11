import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSchoolsQuery } from "@/src/api/schools";
import { useAuthStore } from "@/src/store/authStore";
import { School } from "@/src/types";

// Écran "Mes écoles" — équivalent mobile de frontend/src/pages/SchoolsPage.tsx,
// premier écran protégé de l'app. Consomme GET /schools SANS AUCUNE
// adaptation backend (voir plan mobile, section 1.1) : preuve de bout en
// bout que le repli Authorization: Bearer fonctionne sur une route métier
// existante, pas seulement sur le nouveau module mobile-auth.
//
// Itération 92 — DEUXIÈME écran migré vers NativeWind (le premier était
// `[schoolId]/settings.tsx`, itération 90) : `StyleSheet.create` → 100%
// `className`, aucun changement de comportement ni de texte (donc
// `maestro/login.yaml`, qui s'arrête à "Bonjour,.*" sur cet écran, reste
// valide tel quel). Même précaution qu'à l'itération 90 : syntaxe crochets
// (`text-[13px]`, `bg-[#f5f7fa]`...) pour les valeurs qui ne tombent pas
// pile sur l'échelle Tailwind par défaut, classes utilitaires standard
// seulement quand elles correspondent EXACTEMENT (`p-4` = 16px, `text-base`
// = 16px) — jamais une approximation à l'échelle la plus proche. Choisi
// comme deuxième écran (plutôt qu'un des ~19 autres) car c'est le tout
// premier écran vu après connexion — haute visibilité — et le plus simple
// (une liste + un en-tête, aucun état conditionnel complexe autre que le
// vide/erreur déjà présents avant migration).
//
// `FlatList` supporte `className` via le remapProps intégré de
// `react-native-css-interop`, mais `contentContainerClassName` s'est révélé
// ne pas s'appliquer correctement à l'usage réel sur device (voir itération
// 116, remplacement de tous les `contentContainerClassName` du projet par
// `contentContainerStyle` + objet de style natif) — ici le style
// conditionnel (centré verticalement seulement si la liste est vide) reste
// donc un `contentContainerStyle` conditionnel, comme avant la migration
// NativeWind de l'itération 92, mais avec un objet plutôt qu'un
// `StyleSheet.create`.
export default function SchoolsScreen() {
  const router = useRouter();
  const { data: schools, isLoading, isError, refetch, isRefetching } = useSchoolsQuery();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function renderItem({ item }: { item: School }) {
    return (
      <Pressable
        className="mb-[10px] rounded-[10px] bg-[#f5f7fa] p-4"
        onPress={() => router.push(`/(app)/schools/${item.id}/dashboard`)}
      >
        <Text className="text-base font-semibold">{item.name}</Text>
        {item.island && <Text className="mt-[2px] text-[13px] text-[#666]">{item.island}</Text>}
      </Pressable>
    );
  }

  return (
    <View className="flex-1 bg-white p-4">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-base font-semibold">Bonjour, {user?.fullName ?? ""}</Text>
        <Pressable onPress={() => logout()}>
          <Text className="text-[#c0392b]">Déconnexion</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-[40px]" />
      ) : isError ? (
        <Text className="mt-[40px] text-center text-[#c0392b]">
          Impossible de charger vos écoles. Vérifiez votre connexion.
        </Text>
      ) : (
        <FlatList
          data={schools}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={<Text className="text-center text-[#999]">Aucune école pour le moment.</Text>}
          contentContainerStyle={schools?.length ? undefined : { flex: 1, justifyContent: "center" }}
        />
      )}
    </View>
  );
}
