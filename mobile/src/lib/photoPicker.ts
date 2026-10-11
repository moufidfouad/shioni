import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { showErrorToast } from "./toast";

// Phase 3c (itération 80) — capture/sélection de photo d'identité. Le plan
// mobile (section 4.3) esquissait un `PhotoCaptureDialog.tsx` bâti sur
// `expo-camera` (CameraView custom, machine à 3 états view/camera/review),
// en miroir direct de `PhotoManagerDialog.tsx` côté web. Choix DÉLIBÉRÉMENT
// différent ici, affiné à l'implémentation : `expo-image-picker` couvre les
// DEUX usages (`launchCameraAsync`/`launchImageLibraryAsync`) via les vues
// natives de l'OS lui-même — pas de composant caméra custom à construire, un
// écran de recadrage/validation déjà fourni par l'OS (`allowsEditing: true`)
// qui remplit exactement le rôle de l'état "review" du web sans code
// supplémentaire. Moins de surface native ajoutée qu'un vrai `CameraView`
// (déjà bien assez de pièges natifs rencontrés cette itération avec MMKV) ;
// `expo-image-picker` est de toute façon dans les dépendances recommandées
// du plan (tableau de fin de document), donc pas un ajout hors périmètre.
export type PickedPhoto = { uri: string };

// Action combinée "Prendre une photo" / "Choisir depuis la galerie", avec
// permission demandée juste avant le lancement correspondant (jamais les
// deux d'un coup) — reproduit la seule dépendance concrète du composant.
//
// Itération 112 — `onDocument` (optionnel) ajoute un troisième bouton
// "Choisir un document", UNIQUEMENT quand fourni : seul le composeur de la
// Messagerie le passe (voir handleAttachDocument, messaging/
// [conversationId]/index.tsx) — `EditablePhoto.tsx` (identité élève/
// personnel/logo d'école) continue d'appeler cette fonction SANS
// `onDocument`, donc sans aucun changement de comportement pour lui. Titre
// de l'Alert devient "Pièce jointe" dans ce cas (plus juste que "Photo" dès
// qu'un document texte/PDF est proposé), "Photo" sinon — inchangé pour tous
// les appelants existants.
export function presentPhotoSourceOptions(options: {
  canRemove: boolean;
  onCamera: () => void;
  onLibrary: () => void;
  onRemove?: () => void;
  onDocument?: () => void;
}) {
  const buttons: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [
    { text: "Prendre une photo", onPress: options.onCamera },
    { text: "Choisir depuis la galerie", onPress: options.onLibrary },
  ];
  if (options.onDocument) {
    buttons.push({ text: "Choisir un document", onPress: options.onDocument });
  }
  if (options.canRemove && options.onRemove) {
    buttons.push({ text: "Supprimer la photo", style: "destructive", onPress: options.onRemove });
  }
  buttons.push({ text: "Annuler", style: "cancel" });
  Alert.alert(options.onDocument ? "Pièce jointe" : "Photo", undefined, buttons);
}

// `quality: 0.7` + recadrage carré forcé : suffisant pour une vignette
// d'identité, reste confortablement sous `PHOTOS_MAX_FILE_MB` (5 Mo par
// défaut, `middleware/imageUpload.ts`) même pour une photo prise en pleine
// résolution par un appareil récent.
export async function pickPhotoFrom(source: "camera" | "library"): Promise<PickedPhoto | null> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    showErrorToast(
      source === "camera"
        ? "Autorisation caméra refusée — activez-la dans les réglages du téléphone."
        : "Autorisation d'accès aux photos refusée — activez-la dans les réglages du téléphone."
    );
    return null;
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });

  if (result.canceled || !result.assets?.[0]) return null;
  return { uri: result.assets[0].uri };
}

// Itération 85 — pièce jointe IMAGE en Messagerie (scope volontairement
// réduit à l'époque : uniquement des images, via `expo-image-picker` déjà
// dépendance depuis l'itération 80 — `expo-document-picker` introduit
// seulement à l'itération 112, voir `pickMessageDocument` plus bas, une fois
// le cadrage PDF/bureautique explicitement demandé). Distincte de
// `pickPhotoFrom` ci-dessus : PAS de recadrage carré forcé (`allowsEditing`/
// `aspect: [1,1]`), qui n'aurait aucun sens pour une photo envoyée dans une
// discussion — l'utilisateur envoie l'image telle quelle, seulement
// recompressée (`quality: 0.6`, un peu plus agressif que le 0.7 des photos
// d'identité : reste confortablement sous MESSAGING_MAX_ATTACHMENT_MB, 10
// Mo par défaut).
export async function pickMessageAttachment(source: "camera" | "library"): Promise<PickedPhoto | null> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    showErrorToast(
      source === "camera"
        ? "Autorisation caméra refusée — activez-la dans les réglages du téléphone."
        : "Autorisation d'accès aux photos refusée — activez-la dans les réglages du téléphone."
    );
    return null;
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });

  if (result.canceled || !result.assets?.[0]) return null;
  return { uri: result.assets[0].uri };
}

// Itération 112 — pièce jointe DOCUMENT (PDF/bureautique) en Messagerie,
// dernière lacune mobile face au web identifiée à l'itération 111. Type
// distinct de `PickedPhoto` : contrairement à une image (nom/type toujours
// reconstruits côté appelant, `attachment-${Date.now()}.jpg`), un document
// DOIT garder son nom et son type MIME d'origine — un ".pdf" envoyé comme
// ".jpg" ne s'ouvrirait dans aucune visionneuse côté destinataire.
export interface PickedAttachment {
  uri: string;
  name: string;
  type: string;
}

// Liste blanche alignée sur `ATTACHMENT_ALLOWED_MIME_TYPES` côté web
// (`frontend/src/features/messaging/api.ts`, miroir de la liste serveur
// `messaging.upload.ts::ALLOWED_MIME_TYPES`) MOINS les types image — déjà
// couverts par `pickMessageAttachment`/le bouton caméra-galerie existant,
// pas de raison de les proposer une seconde fois via ce chemin.
const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/zip",
];

// `expo-document-picker` : sélecteur de fichier SYSTÈME (Fichiers/Drive sur
// Android, Fichiers/iCloud sur iOS) — contrairement à `expo-image-picker`,
// aucune permission d'exécution à demander au préalable (l'OS gère l'accès
// lui-même via le sélecteur natif). `copyToCacheDirectory: true` (valeur par
// défaut, explicite ici) : copie le fichier choisi dans le cache de l'app
// AVANT de renvoyer son URI — nécessaire pour qu'`api.post` (FormData) et un
// éventuel export/partage ultérieur puissent le relire, un document ouvert
// "in place" depuis Drive/iCloud n'étant pas toujours accessible en dehors
// du sélecteur lui-même.
export async function pickMessageDocument(): Promise<PickedAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: DOCUMENT_MIME_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    // Liste blanche SERVEUR (`messaging.upload.ts`) toujours la source de
    // vérité en dernier recours — un `mimeType` absent (déjà vu sur
    // certains fournisseurs de stockage Android) tomberait sur
    // "application/octet-stream", hors liste blanche, rejeté proprement en
    // toast plutôt que d'envoyer un type inventé qui passerait à tort.
    type: asset.mimeType ?? "application/octet-stream",
  };
}
