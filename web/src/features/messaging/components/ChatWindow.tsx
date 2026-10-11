import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_ALLOWED_MIME_TYPES,
  attachmentUrl,
  useConversationsQuery,
  useMarkConversationReadMutation,
  useMessagesQuery,
  useSendAttachmentMutation,
  useSendMessageMutation,
} from "../api";
import { useAuth } from "@/providers/contexts/AuthContext/context";
import UploadProgress from "@/components/UploadProgress";
import type { Message } from "@/types";
import { useMessagingSocketContext } from "@/providers/contexts/MessagingSocketContext/context";

const MAX_ATTACHMENT_MB = 10;
const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
const TYPING_DEBOUNCE_MS = 2000;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function MessageBubble({
  message,
  mine,
  schoolId,
}: {
  message: Message;
  mine: boolean;
  schoolId: string;
}) {
  const isImage =
    message.hasAttachment &&
    message.attachmentType &&
    IMAGE_TYPES.has(message.attachmentType);
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] space-y-1.5 rounded-lg px-3 py-2 text-sm",
          mine ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {!mine && (
          <p className="text-xs font-semibold opacity-80">
            {message.sender.fullName}
          </p>
        )}
        {message.hasAttachment &&
          (isImage ? (
            <img
              src={attachmentUrl(schoolId, message.id)}
              alt={message.attachmentName ?? "Pièce jointe"}
              className="max-h-64 max-w-full rounded-md object-contain"
            />
          ) : (
            <a
              href={attachmentUrl(schoolId, message.id)}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex items-center gap-2 truncate underline underline-offset-2",
                mine ? "text-primary-foreground" : "text-foreground",
              )}
            >
              <Paperclip className="size-3.5 shrink-0" />
              <span className="truncate">
                {message.attachmentName ?? "Pièce jointe"}
              </span>
              <span className="shrink-0 opacity-70">
                {formatSize(message.attachmentSize)}
              </span>
            </a>
          ))}
        {message.content && (
          <p className="whitespace-pre-wrap wrap-break-word">
            {message.content}
          </p>
        )}
        <p className={cn("text-right text-[10px] opacity-70")}>
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function ChatWindow({
  schoolId,
  conversationId,
  onManageParticipants,
}: {
  schoolId: string;
  conversationId: string;
  onManageParticipants: () => void;
}) {
  const { user } = useAuth();
  const conversationsQuery = useConversationsQuery(schoolId);
  const conversation =
    conversationsQuery.data?.find((c) => c.id === conversationId) ?? null;

  const messagesQuery = useMessagesQuery(schoolId, conversationId);
  const sendMessage = useSendMessageMutation(schoolId, conversationId);
  const sendAttachment = useSendAttachmentMutation(schoolId, conversationId);
  const markRead = useMarkConversationReadMutation(schoolId);
  const {
    typingByConversation,
    readReceiptsByConversation,
    onlineUserIds,
    emitTypingStart,
    emitTypingStop,
  } = useMessagingSocketContext();

  const [draft, setDraft] = useState("");
  const [attachmentProgress, setAttachmentProgress] = useState<number | null>(
    null,
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listTopRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(
    () => messagesQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [messagesQuery.data],
  );
  const lastMessage = messages[messages.length - 1];

  // Marque la conversation comme lue à l'ouverture, ET à chaque nouveau
  // message qui y arrive pendant qu'elle reste affichée (l'utilisateur est
  // en train de la regarder — pas besoin d'attendre une action explicite).
  useEffect(() => {
    if (conversationId) markRead.mutate(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, lastMessage?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversationId]);

  function handleTypingChange(value: string) {
    setDraft(value);
    emitTypingStart(conversationId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(
      () => emitTypingStop(conversationId),
      TYPING_DEBOUNCE_MS,
    );
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    emitTypingStop(conversationId);
    try {
      await sendMessage.mutateAsync(content);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Envoi impossible.");
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${MAX_ATTACHMENT_MB} Mo).`);
      return;
    }
    // Audit §4.4/§6 Should — retour immédiat côté client avant l'envoi ; le
    // serveur (`fileFilter` multer) reste la seule vérification qui compte,
    // celle-ci n'évite qu'un aller-retour réseau inutile sur un type déjà
    // reconnaissable localement.
    if (!ATTACHMENT_ALLOWED_MIME_TYPES.has(file.type)) {
      toast.error("Type de fichier non autorisé.");
      return;
    }
    setAttachmentProgress(0);
    try {
      await sendAttachment.mutateAsync({
        file,
        onUploadProgress: setAttachmentProgress,
      });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error || "Envoi de la pièce jointe impossible.",
      );
    } finally {
      setAttachmentProgress(null);
    }
  }

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }

  const otherId =
    conversation.type === "PRIVATE"
      ? conversation.participants.find((p) => p.userId !== user?.id)?.userId
      : undefined;
  const online = Boolean(otherId && onlineUserIds.has(otherId));
  const typingUserIds = (typingByConversation[conversationId] ?? []).filter(
    (id) => id !== user?.id,
  );
  const typingNames = typingUserIds
    .map(
      (id) => conversation.participants.find((p) => p.userId === id)?.fullName,
    )
    .filter(Boolean);

  // Accusé de lecture — n'affiché que sous mon PROPRE dernier message, et
  // seulement si un AUTRE participant l'a lu (voir le commentaire sur
  // `ConversationParticipant.lastReadAt` côté backend : un curseur par
  // participant, pas une ligne par message/lecteur — on ne peut donc savoir
  // que "untel a lu jusqu'à tel message", jamais "untel a lu CE message
  // précis" ; afficher "Lu" sous le tout dernier message envoyé par moi est
  // donc la seule information fiable à en tirer côté UI).
  const readers = Object.values(
    readReceiptsByConversation[conversationId] ?? {},
  ).filter(
    (r) =>
      r.userId !== user?.id &&
      lastMessage &&
      new Date(r.lastReadAt) >= new Date(lastMessage.createdAt),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {conversation.displayName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.type === "PRIVATE"
              ? online
                ? "En ligne"
                : "Hors ligne"
              : `${conversation.participants.length} membres`}
          </p>
        </div>
        {conversation.type === "GROUP" && conversation.myRole === "ADMIN" && (
          <Button size="sm" variant="outline" onClick={onManageParticipants}>
            <Users className="mr-1.5 size-3.5" /> Membres
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        <div ref={listTopRef} />
        {messagesQuery.hasNextPage && (
          <div className="flex justify-center pb-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={messagesQuery.isFetchingNextPage}
              onClick={() => messagesQuery.fetchNextPage()}
            >
              {messagesQuery.isFetchingNextPage
                ? "Chargement…"
                : "Voir les messages précédents"}
            </Button>
          </div>
        )}
        {messages.length === 0 && !messagesQuery.isLoading && (
          <p className="text-center text-sm text-muted-foreground">
            Aucun message. Écrivez le premier ci-dessous.
          </p>
        )}
        {/* audit §4.4/§8 : silence total pour un lecteur d'écran sur le contenu
            poussé en temps réel — `role="log"` (implique aria-live="polite")
            + `aria-relevant="additions"` n'annonce que les NOUVEAUX messages
            qui arrivent pendant que la conversation reste ouverte, pas tout
            l'historique déjà chargé à l'ouverture. Isolé du reste (indicateur
            de saisie, accusé de lecture) dans son propre conteneur pour
            éviter d'imbriquer plusieurs régions live les unes dans les
            autres. */}
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Messages de la conversation"
          className="space-y-2"
        >
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              mine={message.senderId === user?.id}
              schoolId={schoolId}
            />
          ))}
        </div>
        {readers.length > 0 && (
          <p
            role="status"
            className="pr-1 text-right text-[10px] text-muted-foreground"
          >
            Lu par{" "}
            {readers
              .map(
                (r) =>
                  conversation.participants.find((p) => p.userId === r.userId)
                    ?.fullName,
              )
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
        {typingNames.length > 0 && (
          <p
            role="status"
            className="pl-1 text-xs italic text-muted-foreground"
          >
            {typingNames.join(", ")}{" "}
            {typingNames.length > 1
              ? "sont en train d'écrire…"
              : "est en train d'écrire…"}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3">
        {attachmentProgress !== null && (
          <div className="pb-2">
            <UploadProgress
              percent={attachmentProgress}
              label="Envoi de la pièce jointe…"
            />
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            hidden
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={sendAttachment.isPending}
            onClick={() => fileInputRef.current?.click()}
            title="Joindre un fichier"
          >
            <Paperclip className="size-4" />
          </Button>
          <Textarea
            value={draft}
            onChange={(e) => handleTypingChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Écrire un message… (Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne)"
            className="h-10 min-h-0 flex-1 resize-none py-2"
          />
          <Button
            type="button"
            size="icon"
            disabled={!draft.trim() || sendMessage.isPending}
            onClick={handleSend}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
