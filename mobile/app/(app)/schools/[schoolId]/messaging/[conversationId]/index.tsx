import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  useConversationQuery,
  useMarkConversationReadMutation,
  useMessagesQuery,
  usePresenceQuery,
  useSendMessageMutation,
  useSendMessageWithAttachmentMutation,
} from "@/src/api/messaging";
import { useMessagingSocketContext } from "@/src/lib/messagingSocket";
import { useIsOffline } from "@/src/lib/useNetworkStatus";
import { useAuthStore } from "@/src/store/authStore";
import { showErrorToast } from "@/src/lib/toast";
import { presentPhotoSourceOptions, pickMessageAttachment, pickMessageDocument } from "@/src/lib/photoPicker";
import { downloadAndOpenAttachment } from "@/src/lib/attachmentDownload";
import { AttachmentImage } from "@/src/components/AttachmentImage";
import { Message } from "@/src/types";

// Écran "Fil de discussion" (Phase 2c, itération 74) — miroir mobile de
// frontend/src/features/messaging/components/ChatWindow.tsx : mêmes règles
// (REST écrit via useSendMessageMutation, le socket ne fait que diffuser —
// voir src/api/messaging.ts ; TYPING_DEBOUNCE_MS = 2000 avant d'émettre
// "typing:stop" après une frappe, identique au web, à distinguer du
// TYPING_TIMEOUT_MS = 5000 côté RÉCEPTION dans messagingSocket.tsx qui
// nettoie un statut "en train d'écrire" resté bloqué si "typing:stop" se
// perd). Composition du message via Formik + Yup + toast (convention
// itération 71, voir mobile/README.md) — premier formulaire mobile à un seul
// champ texte plutôt qu'un formulaire classique, mais la convention reste
// applicable telle quelle. Itération 85 : bouton 📎 à côté du composeur pour
// une pièce jointe IMAGE (voir useSendMessageWithAttachmentMutation,
// api/messaging.ts) — formulaire séparé de Formik/Yup (pas de champ texte à
// valider, juste un choix caméra/galerie). Itération 112 : même bouton 📎,
// troisième option "Choisir un document" (PDF/bureautique, voir
// photoPicker.ts::pickMessageDocument) — et les pièces jointes non-image
// REÇUES deviennent tapables pour être téléchargées/ouvertes (voir
// MessageBubble ci-dessous).
//
// Itération 105 — QUINZIÈME écran migré vers NativeWind : `StyleSheet.
// create` → `className`. Fichier avec le plus grand nombre de styles
// CONDITIONNELS rencontré jusqu'ici dans cette série (bulle mine/theirs,
// pastille en ligne/hors ligne, pièce jointe mine/theirs, boutons
// désactivés) — patron établi à l'itération 95 appliqué systématiquement :
// une seule classe complète choisie par branche, jamais deux classes
// empilées. Couvert par `messaging-attachment.yaml` (Maestro), relu avant
// de commencer : le flow tape sur "Messagerie →" puis "📎" — aucun de ces
// textes ne change, seul le style.
//
// Itération 111 — messagerie de GROUPE (voir src/api/messaging.ts). Fichier
// déplacé de `[conversationId].tsx` vers `[conversationId]/index.tsx` — même
// convention déjà en place pour `children/[studentId]/` (index.tsx +
// timetable.tsx) — pour accueillir un second écran du même groupe de routes
// (`members.tsx`, gestion des membres). Bouton "Membres" ajouté au header
// (`headerRight`, premier usage de cette option dans ce projet mobile —
// équivalent React Navigation standard du bouton du même nom dans
// `ChatWindow.tsx` côté web), visible UNIQUEMENT si `conversation.type ===
// "GROUP" && conversation.myRole === "ADMIN"` — même garde que le web
// (`conversation.type === "GROUP" && conversation.myRole === "ADMIN"` dans
// `ChatWindow.tsx`), le backend revérifiant de toute façon ce rôle à chaque
// action sur l'écran cible.
const TYPING_DEBOUNCE_MS = 2000;

const messageSchema = Yup.object({
  content: Yup.string().trim().min(1, "Message vide.").max(4000, "Message trop long (4000 caractères max)."),
});

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Itération 85 — pièce jointe : IMAGE affichée inline (voir
// AttachmentImage.tsx). Itération 112 — tout autre type (PDF/bureautique,
// envoyé depuis le web OU désormais depuis mobile lui-même, voir
// photoPicker.ts::pickMessageDocument) devient TAPABLE : télécharge puis
// ouvre via le sélecteur d'app du système (`downloadAndOpenAttachment`,
// src/lib/attachmentDownload.ts) — jusqu'à cette itération, cette étiquette
// n'était qu'un texte statique non ouvrable. État `downloading` LOCAL à
// chaque bulle plutôt que centralisé sur l'écran : plusieurs pièces jointes
// non-image peuvent coexister dans un même fil, chacune avec son propre état
// de téléchargement indépendant.
function MessageBubble({ message, mine, schoolId }: { message: Message; mine: boolean; schoolId: string }) {
  const [downloading, setDownloading] = useState(false);

  async function handleOpenAttachment() {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadAndOpenAttachment(schoolId, message.id, message.attachmentName, message.attachmentType);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <View className={`mb-2 flex-row ${mine ? "justify-end" : "justify-start"}`}>
      <View className={`max-w-[75%] rounded-xl px-3 py-2 ${mine ? "bg-[#1d4ed8]" : "bg-[#f0f1f4]"}`}>
        {!mine && <Text className="mb-[2px] text-[11px] font-bold text-[#555]">{message.sender.fullName}</Text>}
        {message.hasAttachment &&
          (message.attachmentType?.startsWith("image/") ? (
            <AttachmentImage schoolId={schoolId} messageId={message.id} />
          ) : (
            <Pressable
              className={`mb-1 flex-row items-center rounded-lg px-[10px] py-2 ${mine ? "bg-[rgba(255,255,255,0.15)]" : "bg-[rgba(0,0,0,0.06)]"}`}
              onPress={handleOpenAttachment}
              disabled={downloading}
            >
              {downloading && <ActivityIndicator size="small" color={mine ? "#fff" : "#333"} className="mr-1.5" />}
              <Text className={`text-[13px] underline ${mine ? "text-white" : "text-[#333]"}`}>
                📎 {message.attachmentName ?? "Pièce jointe"}
              </Text>
            </Pressable>
          ))}
        {message.content && (
          <Text className={mine ? "text-[15px] text-white" : "text-[15px] text-[#111]"}>{message.content}</Text>
        )}
        <Text className={`mt-1 text-right text-[10px] ${mine ? "text-[rgba(255,255,255,0.75)]" : "text-[#888]"}`}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

export default function ConversationScreen() {
  const { schoolId, conversationId } = useLocalSearchParams<{ schoolId: string; conversationId: string }>();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const conversationQuery = useConversationQuery(schoolId, conversationId);
  const conversation = conversationQuery.data;

  const messagesQuery = useMessagesQuery(schoolId, conversationId);
  const sendMessage = useSendMessageMutation(schoolId, conversationId);
  const sendAttachment = useSendMessageWithAttachmentMutation(schoolId, conversationId);
  const markRead = useMarkConversationReadMutation(schoolId);
  const { typingByConversation, onlineUserIds, emitTypingStart, emitTypingStop } = useMessagingSocketContext();
  // Phase 3a (itération 76) — seul écran d'ÉCRITURE du mobile pour
  // l'instant : plutôt que de laisser un appui sur "Envoyer" échouer avec
  // une erreur réseau confuse pendant que l'utilisateur est hors ligne
  // (plan mobile, section 4.6 : "bloquer explicitement les écrans de saisie
  // ... avec un message clair"), le composeur se désactive directement.
  const isOffline = useIsOffline();

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ordre "plus récent en premier" attendu par une FlatList inversée
  // (`inverted`, voir plus bas) : chaque page renvoyée par le backend est
  // déjà chronologique ASCENDANTE en son sein (voir messaging.service.ts::
  // listMessages) — on inverse chaque page individuellement puis on les
  // concatène dans l'ordre où `useInfiniteQuery` les a récupérées (la plus
  // récente d'abord), plutôt que d'aplatir puis inverser l'ensemble.
  const messages = useMemo(
    () => messagesQuery.data?.pages.flatMap((page) => [...page.data].reverse()) ?? [],
    [messagesQuery.data]
  );
  const lastMessageId = messages[0]?.id;

  // Marque la conversation comme lue à l'ouverture ET à chaque nouveau
  // message qui y arrive tant que l'écran reste affiché — même choix que le
  // web (ChatWindow.tsx), pas besoin d'une action explicite de l'utilisateur.
  useEffect(() => {
    if (conversationId) markRead.mutate(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, lastMessageId]);

  const otherId =
    conversation?.type === "PRIVATE"
      ? conversation.participants.find((p) => p.userId !== currentUserId)?.userId
      : undefined;

  // Peinture initiale du statut en ligne avant le premier événement socket
  // "presence:update" pour CE participant — dès qu'un événement arrive pour
  // lui, `onlineUserIds`/`lastSeenByUser` (temps réel) prennent le dessus ;
  // cette requête ne sert donc qu'au tout premier rendu de l'écran.
  const presenceQuery = usePresenceQuery(schoolId, otherId ? [otherId] : []);
  const online = otherId
    ? onlineUserIds.has(otherId) || Boolean(presenceQuery.data?.find((p) => p.userId === otherId)?.online)
    : false;

  const typingUserIds = (typingByConversation[conversationId ?? ""] ?? []).filter((id) => id !== currentUserId);
  const typingNames = typingUserIds
    .map((id) => conversation?.participants.find((p) => p.userId === id)?.fullName)
    .filter((name): name is string => Boolean(name));

  const formik = useFormik({
    initialValues: { content: "" },
    validationSchema: messageSchema,
    onSubmit: async (values, { resetForm, setSubmitting }) => {
      const content = values.content.trim();
      if (!content) {
        setSubmitting(false);
        return;
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      emitTypingStop(conversationId);
      try {
        await sendMessage.mutateAsync(content);
        resetForm();
      } catch {
        showErrorToast("Envoi impossible.");
      } finally {
        setSubmitting(false);
      }
    },
  });

  function handleChangeText(value: string) {
    formik.setFieldValue("content", value);
    emitTypingStart(conversationId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTypingStop(conversationId), TYPING_DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Itération 85 — pièce jointe IMAGE. Erreur déjà affichée par le toast
  // `onError` de la mutation (useSendMessageWithAttachmentMutation) — le
  // `catch` ici n'a qu'à éviter une exception non gérée.
  async function handleAttach(source: "camera" | "library") {
    const asset = await pickMessageAttachment(source);
    if (!asset) return;
    try {
      await sendAttachment.mutateAsync(asset);
    } catch {
      // Rien à faire — toast déjà affiché par la mutation.
    }
  }

  // Itération 112 — pièce jointe DOCUMENT (PDF/bureautique), même mutation
  // que `handleAttach` ci-dessus (`useSendMessageWithAttachmentMutation`
  // accepte désormais aussi `PickedAttachment`, voir api/messaging.ts).
  async function handleAttachDocument() {
    const asset = await pickMessageDocument();
    if (!asset) return;
    try {
      await sendAttachment.mutateAsync(asset);
    } catch {
      // Rien à faire — toast déjà affiché par la mutation.
    }
  }

  function openAttachmentOptions() {
    presentPhotoSourceOptions({
      canRemove: false,
      onCamera: () => handleAttach("camera"),
      onLibrary: () => handleAttach("library"),
      onDocument: handleAttachDocument,
    });
  }

  const headerSubtitle =
    conversation?.type === "PRIVATE"
      ? online
        ? "En ligne"
        : "Hors ligne"
      : conversation?.type === "GROUP"
        ? `${conversation.participants.length} membre${conversation.participants.length > 1 ? "s" : ""}`
        : undefined;

  const canManageMembers = conversation?.type === "GROUP" && conversation.myRole === "ADMIN";

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: conversation?.displayName ?? "Conversation",
          headerBackTitle: "Messagerie",
          headerRight: canManageMembers
            ? () => (
                <Pressable
                  className="px-2 py-1"
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/schools/[schoolId]/messaging/[conversationId]/members",
                      params: { schoolId, conversationId },
                    })
                  }
                >
                  <Text className="text-[15px] font-semibold text-[#1d4ed8]">Membres</Text>
                </Pressable>
              )
            : undefined,
        }}
      />

      {headerSubtitle && (
        <View className="flex-row items-center px-4 pb-1 pt-2">
          {conversation?.type === "PRIVATE" && (
            <View className={`mr-[6px] h-2 w-2 rounded ${online ? "bg-[#16a34a]" : "bg-[#bbb]"}`} />
          )}
          <Text className="text-xs text-[#666]">{headerSubtitle}</Text>
        </View>
      )}

      {messagesQuery.isLoading ? (
        <ActivityIndicator className="mt-6" />
      ) : messagesQuery.isError ? (
        <Text className="mt-8 text-center text-[#c0392b]">Impossible de charger ce fil de discussion.</Text>
      ) : (
        <FlatList
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ flexGrow: 1, padding: 16 }}
          renderItem={({ item }) => (
            <MessageBubble message={item} mine={item.senderId === currentUserId} schoolId={schoolId} />
          )}
          onEndReached={() => {
            if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
              messagesQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={messagesQuery.isFetchingNextPage ? <ActivityIndicator className="my-3" /> : null}
          ListEmptyComponent={
            <Text className="mt-4 -scale-y-100 text-center text-[#999]">Aucun message pour l'instant — dites bonjour !</Text>
          }
        />
      )}

      {typingNames.length > 0 && (
        <Text className="px-4 pb-1 text-xs italic text-[#888]">
          {typingNames.length === 1 ? `${typingNames[0]} écrit…` : "Plusieurs personnes écrivent…"}
        </Text>
      )}

      {isOffline ? (
        <Text className="m-3 rounded-lg bg-[#fef3c7] p-3 text-center text-[13px] text-[#78350f]">
          Vous êtes hors ligne — l'envoi de message est indisponible pour l'instant.
        </Text>
      ) : (
        <View className="flex-row items-end border-t border-t-[#eee] p-3">
          <Pressable
            className={`mr-2 h-10 w-10 items-center justify-center rounded-[20px] bg-[#f0f1f4] ${sendAttachment.isPending ? "opacity-60" : ""}`}
            onPress={openAttachmentOptions}
            disabled={sendAttachment.isPending}
          >
            {sendAttachment.isPending ? (
              <ActivityIndicator size="small" color="#1d4ed8" />
            ) : (
              <Text className="text-lg">📎</Text>
            )}
          </Pressable>
          <TextInput
            className="mr-2 max-h-[120px] flex-1 rounded-[20px] border border-[#d0d0d0] px-3.5 py-2.5 text-[15px]"
            placeholder="Votre message…"
            value={formik.values.content}
            onChangeText={handleChangeText}
            onBlur={formik.handleBlur("content")}
            multiline
            maxLength={4000}
          />
          <Pressable
            className={`items-center justify-center rounded-[20px] bg-[#1d4ed8] px-4 py-2.5 ${formik.isSubmitting ? "opacity-60" : ""}`}
            onPress={() => formik.handleSubmit()}
            disabled={formik.isSubmitting || !formik.values.content.trim()}
          >
            {formik.isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-sm font-semibold text-white">Envoyer</Text>
            )}
          </Pressable>
        </View>
      )}
      {formik.touched.content && formik.errors.content && (
        <Text className="px-4 pb-2 text-xs text-[#c0392b]">{formik.errors.content}</Text>
      )}
    </KeyboardAvoidingView>
  );
}
