import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AuthenticatedPhoto } from "./AuthenticatedPhoto";
import { PickedPhoto, pickPhotoFrom, presentPhotoSourceOptions } from "../lib/photoPicker";

// Phase 3c (itération 80) — variante ÉDITABLE d'AuthenticatedPhoto (Phase
// 2d, inchangée, toujours utilisée telle quelle en LECTURE SEULE partout
// ailleurs : listes, autres fiches). Réservée aux deux seuls écrans où le
// rôle courant autorise l'écriture de la photo (`students/[studentId].tsx`
// SI `school.myRoles` contient ADMIN/GESTION_ELEVES, `personnel/
// [staffId].tsx` toujours — tout le routeur backend est déjà ADMIN, voir
// commentaire existant dans src/api/personnel.ts). La photo est la SEULE
// exception délibérément ouverte au "LECTURE SEULE" du reste de ces deux
// modules mobile — pas un déverrouillage silencieux du CRUD élève/personnel,
// qui reste réservé au web (voir commentaires students.ts/personnel.ts).
export function EditablePhoto({
  uri,
  hasPhoto,
  fullName,
  size = 84,
  uploading,
  onPick,
  onRemove,
}: {
  uri: string;
  hasPhoto?: boolean;
  fullName: string;
  size?: number;
  uploading: boolean;
  onPick: (asset: PickedPhoto) => void;
  onRemove?: () => void;
}) {
  async function handleSource(source: "camera" | "library") {
    const asset = await pickPhotoFrom(source);
    if (asset) onPick(asset);
  }

  function handlePress() {
    if (uploading) return;
    presentPhotoSourceOptions({
      canRemove: Boolean(hasPhoto),
      onCamera: () => handleSource("camera"),
      onLibrary: () => handleSource("library"),
      onRemove,
    });
  }

  return (
    <Pressable onPress={handlePress} disabled={uploading} style={styles.wrapper}>
      <AuthenticatedPhoto uri={uri} hasPhoto={hasPhoto} fullName={fullName} size={size} />
      <View style={styles.badge}>
        {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.badgeIcon}>📷</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative" },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1d4ed8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeIcon: { fontSize: 13 },
});
