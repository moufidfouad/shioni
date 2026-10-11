import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  studentPhotoUrl,
  useRemoveStudentPhotoMutation,
  useStudentQuery,
  useUploadStudentPhotoMutation,
} from "@/src/api/students";
import { useSchoolQuery } from "@/src/api/schools";
import { AuthenticatedPhoto } from "@/src/components/AuthenticatedPhoto";
import { EditablePhoto } from "@/src/components/EditablePhoto";
import { useAuthStore } from "@/src/store/authStore";

// Fiche élève en LECTURE SEULE (Phase 2d, itération 75) — `GET
// /schools/:schoolId/students/:studentId` (`requireAnySchoolRole` +
// portée Enseignant, voir students.routes.ts) : un compte ENSEIGNANT scopé
// à d'autres classes que celle de cet élève reçoit un 403 côté serveur —
// non géré spécialement ici, l'élève n'apparaît de toute façon jamais dans
// sa liste (students/index.tsx) pour en arriver là par la navigation
// normale.
//
// Phase 3c (itération 80) — SEULE exception à la lecture seule : la photo
// est éditable (EditablePhoto) UNIQUEMENT si `school.myRoles` contient
// ADMIN ou GESTION_ELEVES (même rôles que `canManage` côté backend,
// students.routes.ts) — un ENSEIGNANT continue de voir la fiche en lecture
// seule stricte, AuthenticatedPhoto inchangée. `photoNonce` force
// `<Image>` à retraiter l'URI comme neuve après upload/suppression (même
// réflexe de cache-busting que le web, itération 68) — l'URL de la route
// photo elle-même ne change jamais, seul son contenu change.
//
// Itération 101 — ONZIÈME écran migré vers NativeWind : `StyleSheet.
// create` → `className`, même patron carte/champ que `personnel/
// [staffId].tsx` (itération 99) et `settings.tsx` (itération 90), aucune
// valeur conditionnelle ici (le choix EditablePhoto/AuthenticatedPhoto est
// un choix de COMPOSANT, pas de style). Couvert par `students-browse.yaml`
// (assertion sur "📷", rendu par `EditablePhoto` lui-même — composant non
// touché par cette migration, aucun changement de texte dans ce fichier)
// — flow relu avant de commencer, et son commentaire sur l'absence de Tabs
// corrigé au passage (stale depuis l'itération 91 : Élèves est atteignable
// en `href: null`, pas "Tabs non introduits").
export default function StudentDetailScreen() {
  const { schoolId, studentId } = useLocalSearchParams<{ schoolId: string; studentId: string }>();
  const { data: student, isLoading, isError } = useStudentQuery(schoolId, studentId);
  const { data: school } = useSchoolQuery(schoolId);
  const [photoNonce, setPhotoNonce] = useState(0);

  // Itération 118 — même correctif superadmin que dashboard.tsx.
  const isSuperAdmin = Boolean(useAuthStore((s) => s.user)?.isSuperAdmin);
  const canManagePhoto = Boolean(
    school?.myRoles?.includes("ADMIN") || school?.myRoles?.includes("GESTION_ELEVES") || isSuperAdmin
  );
  const uploadPhoto = useUploadStudentPhotoMutation(schoolId, studentId);
  const removePhoto = useRemoveStudentPhotoMutation(schoolId, studentId);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (isError || !student) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-center text-[#c0392b]">Impossible de charger cette fiche élève.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Stack.Screen options={{ title: student.fullName }} />

      <View className="mb-4 items-center">
        {canManagePhoto ? (
          <EditablePhoto
            uri={`${studentPhotoUrl(schoolId, student.id)}${photoNonce ? `?v=${photoNonce}` : ""}`}
            hasPhoto={student.hasPhoto}
            fullName={student.fullName}
            size={84}
            uploading={uploadPhoto.isPending || removePhoto.isPending}
            onPick={(asset) =>
              uploadPhoto.mutate(asset, { onSuccess: () => setPhotoNonce((n) => n + 1) })
            }
            onRemove={() => removePhoto.mutate(undefined, { onSuccess: () => setPhotoNonce((n) => n + 1) })}
          />
        ) : (
          <AuthenticatedPhoto uri={studentPhotoUrl(schoolId, student.id)} hasPhoto={student.hasPhoto} fullName={student.fullName} size={84} />
        )}
        <Text className="mt-[10px] text-lg font-bold">{student.fullName}</Text>
        <Text className="mt-[2px] text-[13px] text-[#888]">{student.matricule}</Text>
      </View>

      <View className="rounded-[10px] bg-[#f5f7fa] p-[14px]">
        <Field label="Classe" value={student.groupe?.name ?? "Non affecté"} />
        <Field label="Sexe" value={student.sex === "M" ? "Masculin" : student.sex === "F" ? "Féminin" : "—"} />
        <Field
          label="Date de naissance"
          value={student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "—"}
        />
        <Field label="Lieu de naissance" value={student.birthPlace || "—"} />
        <Field label="Âge" value={student.age != null ? `${student.age} ans` : "—"} />
      </View>

      <Text className="mb-2 mt-4 text-sm font-semibold text-[#555]">Contact parent</Text>
      <View className="rounded-[10px] bg-[#f5f7fa] p-[14px]">
        <Field label="Nom du parent/tuteur" value={student.parentName || "—"} />
        <Field label="Téléphone" value={student.parentPhone || "—"} />
      </View>

      {(student.nationalIdNumber || student.ministryStudentNumber) && (
        <>
          <Text className="mb-2 mt-4 text-sm font-semibold text-[#555]">Identifiants externes</Text>
          <View className="rounded-[10px] bg-[#f5f7fa] p-[14px]">
            {student.ministryStudentNumber && <Field label="Numéro d'élève (ministère)" value={student.ministryStudentNumber} />}
            {student.nationalIdNumber && <Field label="Carte d'identité nationale" value={student.nationalIdNumber} />}
          </View>
        </>
      )}

      {student.notes && (
        <>
          <Text className="mb-2 mt-4 text-sm font-semibold text-[#555]">Notes</Text>
          <View className="rounded-[10px] bg-[#f5f7fa] p-[14px]">
            <Text className="text-sm leading-5 text-[#333]">{student.notes}</Text>
          </View>
        </>
      )}
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
