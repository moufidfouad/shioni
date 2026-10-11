import { useEffect, useRef, useState } from "react";
import { Camera, ImageOff, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UploadProgress from "./UploadProgress";

const DEFAULT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const DEFAULT_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const DEFAULT_MAX_SIZE_MB = 5;

// Détection de support à froid
const CAMERA_SUPPORTED =
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(header)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

type Mode = "view" | "camera" | "review";

export interface PhotoManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** URL de lecture (voir ex. features/students/api.ts::studentPhotoUrl) — `null` si aucune photo/logo actuellement. */
  photoUrl: string | null;
  /** Libellé de l'image dans l'aperçu (attribut alt) et les messages. */
  entityLabel?: string;
  accept?: string;
  allowedMimeTypes?: Set<string>;
  maxSizeMb?: number;
  onUpload: (
    file: File,
    onProgress: (percent: number) => void,
  ) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}

export default function PhotoManagerDialog({
  open,
  onOpenChange,
  title,
  photoUrl,
  entityLabel = "cet élément",
  accept = DEFAULT_ACCEPT,
  allowedMimeTypes = DEFAULT_ALLOWED_MIME_TYPES,
  maxSizeMb = DEFAULT_MAX_SIZE_MB,
  onUpload,
  onDelete,
}: PhotoManagerDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [imageBroken, setImageBroken] = useState(false);

  const [mode, setMode] = useState<Mode>("view");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const [cacheBust, setCacheBust] = useState(0);
  const busy = progress !== null || deleting;

  function stopCameraStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  // Coupe le flux et revient au mode "view" à la fermeture du dialogue —
  // sinon le voyant caméra du navigateur/OS resterait allumé en arrière-plan
  // et on rouvrirait sur un mode "camera"/"review" obsolète la prochaine fois.
  useEffect(() => {
    if (!open) {
      stopCameraStream();
      setMode("view");
      setCapturedPhoto(null);
      setCacheBust(0);
    }
  }, [open]);

  // Filet de sécurité si le composant est démonté pendant que la caméra est
  // active (navigation brusque, etc.).
  useEffect(() => stopCameraStream, []);

  // Attache le flux à la balise <video> une fois qu'elle est montée (elle
  // n'existe qu'en mode "camera", donc pas avant ce rendu).
  useEffect(() => {
    if (mode === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [mode]);

  async function submitFile(file: File) {
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${maxSizeMb} Mo).`);
      return;
    }
    // Retour immédiat côté client avant l'envoi (même patron que
    // ChatWindow.tsx::handleFileChange) ; le serveur (`fileFilter` multer,
    // middleware/imageUpload.ts) reste la seule vérification qui compte.
    if (!allowedMimeTypes.has(file.type)) {
      toast.error("Type de fichier non autorisé (image uniquement).");
      return;
    }
    setImageBroken(false);
    setProgress(0);
    try {
      await onUpload(file, setProgress);

      setCacheBust(Date.now());
      toast.success("Photo enregistrée.");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error || "Envoi de la photo impossible.",
      );
    } finally {
      setProgress(null);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await submitFile(file);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
      toast.success("Photo retirée.");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error || "Suppression de la photo impossible.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleOpenCamera() {
    try {
      // `facingMode: "user"` = caméra frontale par défaut (photo d'identité
      // typiquement prise face à l'écran) ; le navigateur retombe sur la
      // seule caméra disponible s'il n'y en a qu'une.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCapturedPhoto(null);
      setMode("camera");
    } catch {
      toast.error("Accès à la caméra refusé ou indisponible.");
    }
  }

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedPhoto(canvas.toDataURL("image/jpeg", 0.92));
    stopCameraStream();
    setMode("review");
  }

  function handleCancelCamera() {
    stopCameraStream();
    setCapturedPhoto(null);
    setMode("view");
  }

  // "Reprendre" depuis l'aperçu : redemande le flux (le navigateur ne
  // ré-affiche pas la popup de permission, déjà accordée pour cet onglet).
  async function handleRetake() {
    setCapturedPhoto(null);
    await handleOpenCamera();
  }

  async function handleConfirmCapture() {
    if (!capturedPhoto) return;
    const file = dataUrlToFile(capturedPhoto, `photo-${Date.now()}.jpg`);
    setCapturedPhoto(null);
    setMode("view");
    await submitFile(file);
  }

  const showPreview = photoUrl && !imageBroken;

  const displayPhotoUrl =
    showPreview && cacheBust
      ? `${photoUrl}${photoUrl!.includes("?") ? "&" : "?"}v=${cacheBust}`
      : photoUrl;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent hideClose className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex size-36 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {mode === "camera" ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- flux caméra live, pas un média avec piste audio/sous-titres
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="size-full object-cover"
              />
            ) : mode === "review" && capturedPhoto ? (
              <img
                src={capturedPhoto}
                alt="Photo capturée"
                className="size-full object-cover"
              />
            ) : showPreview ? (
              <img
                src={displayPhotoUrl!}
                alt={entityLabel}
                className="size-full object-cover"
                onError={() => setImageBroken(true)}
              />
            ) : (
              <ImageOff className="size-8 text-muted-foreground" aria-hidden />
            )}
          </div>

          {progress !== null && (
            <UploadProgress percent={progress} label="Envoi de la photo…" />
          )}

          {mode === "view" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                hidden
                onChange={handleFileChange}
              />
              <div className="flex w-full gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 size-3.5" />
                  {showPreview ? "Changer" : "Ajouter"}
                </Button>
                {CAMERA_SUPPORTED && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={handleOpenCamera}
                  >
                    <Camera className="mr-1.5 size-3.5" />
                    Caméra
                  </Button>
                )}
                {showPreview && (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy}
                    onClick={handleDelete}
                  >
                    <Trash2 className="mr-1.5 size-3.5" />
                    {deleting ? "Suppression…" : "Retirer"}
                  </Button>
                )}
              </div>
            </>
          )}

          {mode === "camera" && (
            <div className="flex w-full gap-2">
              <Button type="button" className="flex-1" onClick={handleCapture}>
                <Camera className="mr-1.5 size-3.5" />
                Capturer
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelCamera}
              >
                <X className="mr-1.5 size-3.5" />
                Annuler
              </Button>
            </div>
          )}

          {mode === "review" && (
            <div className="flex w-full flex-col gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={handleConfirmCapture}
              >
                <Upload className="mr-1.5 size-3.5" />
                Utiliser cette photo
              </Button>
              <div className="flex w-full gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={handleRetake}
                >
                  <RotateCcw className="mr-1.5 size-3.5" />
                  Reprendre
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={handleCancelCamera}
                >
                  <X className="mr-1.5 size-3.5" />
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={busy}>
              Fermer
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
