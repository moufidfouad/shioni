import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getAccessToken } from "../api/tokenStorage";
import { LEGACY_API_URL } from "../config";
import { showErrorToast } from "./toast";

// Itération 112 — ouverture d'une pièce jointe NON-image reçue (PDF/
// bureautique, voir photoPicker.ts::pickMessageDocument pour l'envoi). Une
// image s'affiche déjà inline (AttachmentImage.tsx, itération 85) ; un PDF/
// document n'a pas d'équivalent "inline" raisonnable sur mobile — la seule
// action sensée est de le télécharger puis de l'ouvrir avec une application
// installée sur l'appareil (visionneuse PDF, Word, Excel...), via le
// sélecteur de partage/ouverture natif du système (`expo-sharing`).
//
// `GET .../attachments/:messageId` n'est jamais un `express.static` (même
// piège que `AttachmentImage.tsx`/`messageAttachmentUrl` : vérifie
// l'appartenance à la conversation, voir messaging.controller.ts::
// downloadAttachment) — nécessite `Authorization: Bearer` explicite.
// `File.downloadFileAsync` (API `expo-file-system` "next", pas l'ancienne
// `FileSystem.downloadAsync` de `expo-file-system/legacy`) accepte des
// `headers` personnalisés, comme `AttachmentImage.tsx` avant elle on récupère
// le jeton directement via `getAccessToken()` plutôt que de passer par
// l'instance axios `api` — même compromis délibéré que ce précédent : pas de
// rafraîchissement automatique en cas de jeton expiré pile à ce moment précis
// (fenêtre de 15 min, voir backend/src/utils/jwt.ts), l'utilisateur retente
// simplement le tap si besoin plutôt que d'ajouter ici une logique de retry
// dupliquée avec celle déjà centralisée dans `api/client.ts`.
export async function downloadAndOpenAttachment(
  schoolId: string,
  messageId: string,
  attachmentName: string | null,
  attachmentType: string | null
): Promise<void> {
  try {
    const token = await getAccessToken();
    if (!token) {
      showErrorToast("Session expirée — reconnectez-vous puis réessayez.");
      return;
    }

    const safeName = sanitizeFileName(attachmentName) || `piece-jointe-${messageId}`;
    const destination = new File(Paths.cache, safeName);
    const url = `${LEGACY_API_URL}/schools/${schoolId}/messaging/attachments/${messageId}`;

    const file = await File.downloadFileAsync(url, destination, {
      headers: { Authorization: `Bearer ${token}` },
      // Un même document déjà téléchargé lors d'un tap précédent ne doit
      // pas faire échouer ce second tap — voir DownloadOptions.idempotent.
      idempotent: true,
    });

    if (!(await Sharing.isAvailableAsync())) {
      showErrorToast("Aucune application disponible pour ouvrir ce fichier sur cet appareil.");
      return;
    }

    await Sharing.shareAsync(file.uri, {
      mimeType: attachmentType ?? undefined,
      dialogTitle: attachmentName ?? undefined,
    });
  } catch {
    showErrorToast("Téléchargement de la pièce jointe impossible.");
  }
}

// Le nom d'origine (`Message.attachmentName`) traverse déjà multer côté
// serveur sans normalisation de caractères dangereux pour un chemin de
// fichier LOCAL (seul le nom de fichier sur disque serveur est généré,
// jamais celui affiché — voir messaging.upload.ts) : un `/`/`\` dans un nom
// de document réel casserait `new File(...)` en le lisant comme un
// sous-dossier. Remplacement minimal plutôt qu'un slug complet — seuls ces
// deux caractères ont un sens spécial pour un chemin de fichier ici.
function sanitizeFileName(name: string | null): string {
  if (!name) return "";
  return name.replace(/[/\\]/g, "_");
}
