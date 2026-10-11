import { QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { extractErrorMessage } from "./auth";
import { LEGACY_API_URL } from "../config";
import { showErrorToast } from "../lib/toast";
import { PickedAttachment, PickedPhoto } from "../lib/photoPicker";
import {
  Conversation,
  ConversationType,
  ListMessagesResult,
  Message,
  MessagingContact,
  PresenceInfo,
} from "../types";

// Phase 2c (itération 74) — Messagerie. Miroir de
// frontend/src/features/messaging/api.ts (mêmes clés de requête, mêmes
// routes, même patron REST-écrit/socket-diffuse — voir le commentaire
// d'en-tête de src/types/index.ts). Messages texte SEULS jusqu'à
// l'itération 84 ; l'itération 85 ajoute l'envoi/l'affichage de pièces
// jointes IMAGE (voir useSendMessageWithAttachmentMutation/
// messageAttachmentUrl plus bas) ; l'itération 112 étend ce même envoi aux
// documents PDF/bureautique (voir plus bas). Rien de tout cela n'est un
// changement backend : les mêmes routes existantes couvrent un périmètre
// plus large que ce que mobile consomme ici.
//
// Itération 111 — messagerie de GROUPE, dernière lacune volontairement
// laissée de côté depuis l'itération 74 (« pas de gestion de groupe...
// cohérent avec la recommandation du plan de ne pas viser une parité 1:1
// avec le web dès la V1 »). Cadrage délégué par l'utilisateur puis confirmé
// via deux `AskUserQuestion` : sujet choisi (messagerie de groupe plutôt que
// pièces jointes PDF/bureautique), puis périmètre étendu à la gestion des
// membres (ajout/retrait), pas seulement la création — voir mobile/README.md
// pour le détail. `useCreateConversationMutation` ci-dessous acceptait déjà
// `type`/`title` sans le consommer côté écran (générique depuis
// l'itération 74) : AUCUN changement ici. `useAddParticipantMutation`/
// `useRemoveParticipantMutation` (nouveau) sont un miroir exact de
// `useAddParticipantMutation`/`useRemoveParticipantMutation` côté web
// (`frontend/src/features/messaging/api.ts`) — mêmes routes déjà existantes,
// aucun changement backend.
//
// Itération 112 — pièces jointes PDF/bureautique, dernière lacune mobile
// face au web identifiée à l'itération 111 (l'autre candidate, non choisie
// à cette itération-là). `useSendMessageWithAttachmentMutation` accepte
// désormais `PickedAttachment` (nom/type réels, voir photoPicker.ts) en plus
// de `PickedPhoto` (nom/type reconstruits — comportement image INCHANGÉ) —
// même route `POST .../messages/attachment`, aucun changement backend (la
// liste blanche MIME serveur, `messaging.upload.ts::ALLOWED_MIME_TYPES`,
// acceptait déjà PDF/bureautique depuis toujours, seul le client mobile ne
// les envoyait jamais). `downloadAndOpenAttachment` (nouveau,
// `src/lib/attachmentDownload.ts`) couvre la RÉCEPTION : télécharger la
// pièce jointe reçue puis l'ouvrir via le sélecteur d'app du système
// (`expo-sharing`), seul moyen d'"afficher" un PDF/document sur mobile —
// contrairement à une image, aucune visionneuse inline n'est construite ici.

export const messagingKeys = {
  contacts: (schoolId: string) => ["messaging", schoolId, "contacts"] as const,
  conversations: (schoolId: string) => ["messaging", schoolId, "conversations"] as const,
  conversation: (schoolId: string, conversationId: string) =>
    ["messaging", schoolId, "conversation", conversationId] as const,
  messages: (schoolId: string, conversationId: string) =>
    ["messaging", schoolId, "conversation", conversationId, "messages"] as const,
  presence: (schoolId: string, userIds: string[]) =>
    ["messaging", schoolId, "presence", [...userIds].sort().join(",")] as const,
};

export function useContactsQuery(schoolId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: messagingKeys.contacts(schoolId ?? ""),
    queryFn: async () => (await api.get<MessagingContact[]>(`/schools/${schoolId}/messaging/contacts`)).data,
    enabled: Boolean(schoolId) && enabled,
    staleTime: 60_000,
  });
}

export function useConversationsQuery(schoolId: string | undefined) {
  return useQuery({
    queryKey: messagingKeys.conversations(schoolId ?? ""),
    queryFn: async () => (await api.get<Conversation[]>(`/schools/${schoolId}/messaging/conversations`)).data,
    enabled: Boolean(schoolId),
    // Complète le temps réel (socket "conversation:updated") : couvre le cas
    // où le socket n'est pas (encore) connecté, même choix que le web.
    refetchInterval: 30_000,
  });
}

export function useConversationQuery(schoolId: string | undefined, conversationId: string | undefined) {
  return useQuery({
    queryKey: messagingKeys.conversation(schoolId ?? "", conversationId ?? ""),
    queryFn: async () =>
      (await api.get<Conversation>(`/schools/${schoolId}/messaging/conversations/${conversationId}`)).data,
    enabled: Boolean(schoolId) && Boolean(conversationId),
  });
}

interface CreateConversationInput {
  type: ConversationType;
  participantUserIds: string[];
  title?: string;
}

// Idempotent côté backend pour une conversation PRIVÉE (Conversation.
// privateKey) : rappeler avec le même contact renvoie la conversation déjà
// existante plutôt que d'en créer une seconde — sûr à appeler à chaque
// tape sur un contact, pas besoin de vérifier côté mobile si une
// conversation existe déjà avant d'appeler cette mutation.
export function useCreateConversationMutation(schoolId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateConversationInput) =>
      (await api.post<Conversation>(`/schools/${schoolId}/messaging/conversations`, input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(schoolId ?? "") }),
  });
}

const MESSAGES_PAGE_SIZE = 30;

// Pagination par curseur (Message.seq), PAS le contrat page/pageSize
// partagé du reste du projet — même choix que le web (`useInfiniteQuery`,
// premier usage côté mobile : un fil de discussion se charge par
// "défiler vers le haut pour voir plus ancien").
export function useMessagesQuery(schoolId: string | undefined, conversationId: string | undefined) {
  return useInfiniteQuery({
    queryKey: messagingKeys.messages(schoolId ?? "", conversationId ?? ""),
    queryFn: async ({ pageParam }) =>
      (
        await api.get<ListMessagesResult>(
          `/schools/${schoolId}/messaging/conversations/${conversationId}/messages`,
          { params: { before: pageParam, limit: MESSAGES_PAGE_SIZE } }
        )
      ).data,
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(schoolId) && Boolean(conversationId),
  });
}

// Insère un message dans le cache de son fil sans dupliquer (dédoublonné
// par id) — appelée par useSendMessageMutation (retour direct du POST) ET
// par le contexte socket (événement "message:new", voir
// src/lib/messagingSocket.tsx) : mon propre socket reçoit aussi mes propres
// messages (sync multi-appareil), jamais de doublon grâce à cette
// déduplication, quel que soit celui qui arrive en premier. Exportée pour
// être appelée depuis messagingSocket.tsx.
export function appendMessageToCache(queryClient: QueryClient, schoolId: string, message: Message) {
  queryClient.setQueryData<{ pages: ListMessagesResult[]; pageParams: unknown[] } | undefined>(
    messagingKeys.messages(schoolId, message.conversationId),
    (current) => {
      if (!current) return current;
      const alreadyPresent = current.pages.some((page) => page.data.some((m) => m.id === message.id));
      if (alreadyPresent) return current;
      const pages = current.pages.map((page, index) =>
        index === current.pages.length - 1 ? { ...page, data: [...page.data, message] } : page
      );
      return { ...current, pages };
    }
  );
  queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(schoolId) });
}

export function useSendMessageMutation(schoolId: string | undefined, conversationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) =>
      (
        await api.post<Message>(`/schools/${schoolId}/messaging/conversations/${conversationId}/messages`, {
          content,
        })
      ).data,
    onSuccess: (message) => appendMessageToCache(queryClient, schoolId ?? "", message),
  });
}

// Itération 85 — URL de téléchargement d'une pièce jointe (jamais un
// `express.static`, voir messaging.upload.ts) : même piège/solution que
// `studentPhotoUrl` (itération 80, api/students.ts) — l'URL seule ne suffit
// pas, un `<Image>` doit y accoler explicitement `Authorization: Bearer`
// (voir src/components/AttachmentImage.tsx). Base LEGACY_API_URL (sans
// /v1) : route métier existante, pas une route mobile dédiée.
export function messageAttachmentUrl(schoolId: string, messageId: string): string {
  return `${LEGACY_API_URL}/schools/${schoolId}/messaging/attachments/${messageId}`;
}

// POST .../messages/attachment — route WEB existante (messaging.routes.ts),
// réutilisée telle quelle. Champ `file` (voir messagingUpload.single("file")
// côté backend) construit depuis `{ uri, name, type }` comme tout upload
// mobile (voir students.ts::useUploadStudentPhotoMutation) — pas de champ
// `content` envoyé ici : la légende accompagnant une image reste hors
// périmètre de cette itération (l'utilisateur retape un message texte
// séparé s'il veut en ajouter un, cohérent avec `content` optionnel côté
// backend).
//
// Itération 112 — accepte aussi `PickedAttachment` (nom/type RÉELS d'un
// document choisi via `pickMessageDocument`) en plus de `PickedPhoto`
// (nom/type reconstruits, comportement image inchangé) : un simple
// discriminant sur la présence de `name`/`type` plutôt qu'un second
// paramètre ou une seconde mutation — un seul appel réseau, une seule
// invalidation de cache, quel que soit le type de pièce jointe.
export function useSendMessageWithAttachmentMutation(
  schoolId: string | undefined,
  conversationId: string | undefined
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (asset: PickedPhoto | PickedAttachment) => {
      const named = "name" in asset && "type" in asset ? asset : null;
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: named?.name ?? `attachment-${Date.now()}.jpg`,
        type: named?.type ?? "image/jpeg",
      } as unknown as Blob);
      const { data } = await api.post<Message>(
        `/schools/${schoolId}/messaging/conversations/${conversationId}/messages/attachment`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data;
    },
    onSuccess: (message) => appendMessageToCache(queryClient, schoolId ?? "", message),
    onError: (err) => showErrorToast(extractErrorMessage(err, "Échec de l'envoi de la pièce jointe.")),
  });
}

export function useMarkConversationReadMutation(schoolId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) =>
      api.post(`/schools/${schoolId}/messaging/conversations/${conversationId}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(schoolId ?? "") }),
  });
}

// Itération 111 — gestion des membres d'un groupe, réservée à l'ADMIN du
// groupe côté backend (`messaging.service.ts::assertGroupAdmin`) — ces deux
// mutations ne revérifient pas ce rôle elles-mêmes, exactement comme le
// dialogue web équivalent (`ParticipantsDialog.tsx`) : l'écran appelant
// (`messaging/[conversationId]/members.tsx`) n'est atteignable que depuis un
// bouton déjà conditionné à `conversation.myRole === "ADMIN"`, et le backend
// referme la porte en dernier recours à chaque requête de toute façon.
export function useAddParticipantMutation(schoolId: string | undefined, conversationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      (
        await api.post<Conversation>(
          `/schools/${schoolId}/messaging/conversations/${conversationId}/participants`,
          { userId }
        )
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(schoolId ?? "") }),
  });
}

// Le backend autorise aussi `targetUserId === meId` (quitter soi-même le
// groupe, sans être admin) — voir le commentaire de `removeParticipant` côté
// backend. Non exposé dans cette UI, exactement comme le web
// (`ParticipantsDialog.tsx` n'est monté que pour un ADMIN) : un membre
// simple n'a aujourd'hui aucun moyen de quitter un groupe depuis le web, le
// mobile ne va pas au-delà de cette parité à cette itération.
export function useRemoveParticipantMutation(schoolId: string | undefined, conversationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      api.delete(`/schools/${schoolId}/messaging/conversations/${conversationId}/participants/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(schoolId ?? "") }),
  });
}

// Peinture initiale du statut en ligne (avant le premier événement socket
// "presence:update") — voir usage dans le fil de discussion, limité au(x)
// participant(s) de la conversation OUVERTE plutôt qu'à tous les contacts,
// pour ne pas multiplier les appels réseau.
export function usePresenceQuery(schoolId: string | undefined, userIds: string[]) {
  return useQuery({
    queryKey: messagingKeys.presence(schoolId ?? "", userIds),
    queryFn: async () =>
      (
        await api.get<PresenceInfo[]>(`/schools/${schoolId}/messaging/presence`, {
          params: { userIds: userIds.join(",") },
        })
      ).data,
    enabled: Boolean(schoolId) && userIds.length > 0,
    staleTime: 30_000,
  });
}
