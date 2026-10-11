import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { schoolLogoUrl, useRemoveSchoolLogoMutation, useSchoolQuery, useUploadSchoolLogoMutation } from "@/src/api/schools";
import { EditablePhoto } from "@/src/components/EditablePhoto";

// Itération 89 — Paramètres de l'école (logo), dernier upload photo/fichier
// resté hors périmètre mobile (voir mobile/README.md, "Ce qui n'est
// volontairement PAS fait") : élèves (itération 80) et personnel
// (itération 80) avaient déjà leur photo éditable depuis la Phase 3c, le
// logo d'école restait le seul manquant. Écran entièrement ADMIN-only —
// même choix que `personnel/index.tsx` (lien affiché uniquement pour
// `school.myRoles.includes("ADMIN")` dans dashboard.tsx) plutôt qu'un
// aiguillage lecture/écriture par rôle comme `students/[studentId].tsx` :
// `POST /schools/:schoolId/logo` est ADMIN-only dans les deux sens côté
// backend (schools.routes.ts), une lecture seule pour d'autres rôles n'a
// donc pas de valeur immédiate ici, contrairement à une fiche élève.
//
// LECTURE SEULE pour le reste des infos de l'école (nom, directeur,
// adresse, île, devise) — même principe que partout ailleurs côté mobile :
// la photo/le logo est la SEULE exception ouverte à l'écriture, jamais un
// déverrouillage silencieux du CRUD complet (`PATCH /schools/:schoolId`
// reste réservé au web, voir SchoolSettingsPage.tsx).
//
// Itération 90 — PREMIER écran migré vers NativeWind (voir
// tailwind.config.js pour le choix du design system), comme référence pour
// les futures itérations : `className` à la place de `StyleSheet.create`,
// aucun changement de comportement ni, en principe, d'apparence — chaque
// classe ci-dessous reprend la valeur EXACTE de l'ancien style inline (via
// la syntaxe crochets `text-[13px]`, `bg-[#f5f7fa]`, etc. plutôt qu'une
// approximation à l'échelle Tailwind la plus proche) pour ne courir aucun
// risque de dérive visuelle non vérifiable dans ce bac à sable (pas
// d'appareil/émulateur disponible ici, voir mobile/README.md). Migration
// des ~20 autres écrans mobile existants délibérément PAS faite dans cette
// même itération — un écran de référence d'abord, le reste itération par
// itération, jamais un big-bang sur toute l'app à la fois sans pouvoir
// vérifier visuellement le résultat.
export default function SchoolSettingsScreen() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  const { data: school, isLoading, isError } = useSchoolQuery(schoolId);
  const [logoNonce, setLogoNonce] = useState(0);

  const uploadLogo = useUploadSchoolLogoMutation(schoolId);
  const removeLogo = useRemoveSchoolLogoMutation(schoolId);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (isError || !school) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-center text-[#c0392b]">Impossible de charger les paramètres de cette école.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: "Paramètres de l'école" }} />

      <View className="mb-4 items-center">
        <EditablePhoto
          uri={`${schoolLogoUrl(schoolId)}${logoNonce ? `?v=${logoNonce}` : ""}`}
          hasPhoto={school.hasLogo}
          fullName={school.name}
          size={96}
          uploading={uploadLogo.isPending || removeLogo.isPending}
          onPick={(asset) => uploadLogo.mutate(asset, { onSuccess: () => setLogoNonce((n) => n + 1) })}
          onRemove={() => removeLogo.mutate(undefined, { onSuccess: () => setLogoNonce((n) => n + 1) })}
        />
        <Text className="mt-[10px] text-lg font-bold">{school.name}</Text>
      </View>

      <View className="rounded-[10px] bg-[#f5f7fa] p-[14px]">
        <Field label="Directeur" value={school.director || "—"} />
        <Field label="Adresse" value={school.address || "—"} />
        <Field label="Île" value={school.island || "—"} />
        <Field label="Devise" value={school.currency} />
      </View>
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-[6px]">
      <Text className="text-[13px] text-[#666]">{label}</Text>
      <Text className="ml-3 shrink text-right text-[13px] font-medium text-[#111]">{value}</Text>
    </View>
  );
}
