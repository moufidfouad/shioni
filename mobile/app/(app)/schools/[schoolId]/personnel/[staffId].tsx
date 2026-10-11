import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  staffPhotoUrl,
  useRemoveStaffPhotoMutation,
  useStaffMemberQuery,
  useUploadStaffPhotoMutation,
} from "@/src/api/personnel";
import { EditablePhoto } from "@/src/components/EditablePhoto";

// Fiche personnel en LECTURE SEULE (Phase 2d, itération 75) — ADMIN
// uniquement, voir personnel/index.tsx (même raisonnement, non répété ici).
// `salaireBrut` est affiché : cette fiche n'est de toute façon atteignable
// que par un compte ADMIN, exactement comme sur le web (PersonnelPage.tsx
// affiche ce champ sans restriction supplémentaire une fois la route
// elle-même franchie).
//
// Phase 3c (itération 80) — SEULE exception à la lecture seule : la photo
// est toujours éditable ici (EditablePhoto, jamais AuthenticatedPhoto
// seule) — contrairement à Élèves, pas de vérification de rôle
// supplémentaire nécessaire : tout le module backend est déjà ADMIN-only,
// lecture comprise (voir personnel.routes.ts), donc quiconque atteint cet
// écran a déjà le droit d'écrire cette photo. `photoNonce` : même réflexe
// de cache-busting que students/[studentId].tsx (voir ce fichier).
//
// Itération 99 — NEUVIÈME écran migré vers NativeWind : `StyleSheet.
// create` → `className`, mêmes classes que `settings.tsx` (itération 90)
// pour le patron carte/champ (`card`/`field`/`fieldLabel`/`fieldValue`,
// styles identiques). Même point de vigilance qu'aux itérations 95/96/98
// pour le badge de statut conditionnel : une seule classe de fond/texte
// choisie explicitement par branche. Non référencé par aucun flow Maestro
// (vérifié avant de commencer).
export default function StaffDetailScreen() {
  const { schoolId, staffId } = useLocalSearchParams<{ schoolId: string; staffId: string }>();
  const { data: staff, isLoading, isError } = useStaffMemberQuery(schoolId, staffId);
  const [photoNonce, setPhotoNonce] = useState(0);

  const uploadPhoto = useUploadStaffPhotoMutation(schoolId, staffId);
  const removePhoto = useRemoveStaffPhotoMutation(schoolId, staffId);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (isError || !staff) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-center text-[#c0392b]">Impossible de charger cette fiche personnel.</Text>
      </View>
    );
  }

  const isActive = staff.statut === "Actif";

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: staff.fullName }} />

      <View className="mb-4 items-center">
        <EditablePhoto
          uri={`${staffPhotoUrl(schoolId, staff.id)}${photoNonce ? `?v=${photoNonce}` : ""}`}
          hasPhoto={staff.hasPhoto}
          fullName={staff.fullName}
          size={84}
          uploading={uploadPhoto.isPending || removePhoto.isPending}
          onPick={(asset) => uploadPhoto.mutate(asset, { onSuccess: () => setPhotoNonce((n) => n + 1) })}
          onRemove={() => removePhoto.mutate(undefined, { onSuccess: () => setPhotoNonce((n) => n + 1) })}
        />
        <Text className="mt-[10px] text-lg font-bold">{staff.fullName}</Text>
        <View className={`mt-[6px] rounded-xl px-[10px] py-1 ${isActive ? "bg-[#dcfce7]" : "bg-[#eee]"}`}>
          <Text className={`text-xs ${isActive ? "font-semibold text-[#16a34a]" : "text-[#666]"}`}>{staff.statut}</Text>
        </View>
      </View>

      <View className="rounded-[10px] bg-[#f5f7fa] p-[14px]">
        <Field label="Fonction" value={staff.fonction || "—"} />
        <Field label="Spécialité" value={staff.specialite || "—"} />
        <Field label="Diplôme" value={staff.diplome || "—"} />
        <Field label="Type de contrat" value={staff.typeContrat || "—"} />
        <Field label="Heures / semaine" value={staff.heuresSemaine != null ? `${staff.heuresSemaine} h` : "—"} />
        <Field
          label="Salaire brut"
          value={staff.salaireBrut != null ? `${Number(staff.salaireBrut).toLocaleString("fr-FR")}` : "—"}
        />
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
