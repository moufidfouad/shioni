import { useInfiniteQuery, useMutation, useQuery, useQueryClient, QueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type {
  Conversation,
  ConversationType,
  ListMessagesResult,
  Message,
  MessagingContact,
  PresenceInfo,
} from "../../types";

// Itération 45 — messagerie instantanée. Décision explicite (voir le
// commentaire d'en-tête de backend/src/modules/messaging/messaging.schema.ts,
// répondant à la demande utilisateur "via REST ou via socket, précisez") :
// TOUTE écriture passe par ces mutations REST, exactement comme les 44
// modules précédents (axios + React Query, toasts sur succès/erreur). Le
// socket (voir ../../hooks/useMessagingSocket.ts) ne sert JAMAIS à écrire —
// seulement à recevoir, en temps réel, ce qu'une mutation REST vient de
// persister ailleurs (un autre participant, ou l'un de mes propres autres
// onglets/appareils).

export const messagingKeys = {
  all: (schoolId: string) => ["messaging", schoolId] as const,
  contacts: (schoolId: string) => ["messaging", schoolId, "contacts"] as const,
  conversations: (schoolId: string) => ["messaging", schoolId, "conversations"] as const,
  messages: (schoolId: string, conversationId: string) =>
    ["messaging", schoolId, "conversation", conversationId, "messages"] as const,
  presence: (schoolId: string, userIds: string[]) =>
    ["messaging", schoolId, "presence", [...userIds].sort().join(",")] as const,
};

export function useContactsQuery(schoolId: string) {
  return useQuery({
    queryKey: messagingKeys.contacts(schoolId),
    queryFn: async ({ signal }) => (await api.get<MessagingContact[]>(`/schools/${schoolId}/messaging/contacts`, { signal })).data,
    // Change rarement (composition du personnel/parents/élèves d'une école) :
    // un `staleTime` plus long que le défaut global (10s) évite de la
    // rafraîchir à chaque ouverture du dialogue "Nouvelle conversation".
    staleTime: 60_000,
  });
}

export function useConversationsQuery(schoolId: string, enabled = true) {
  return useQuery({
    queryKey: messagingKeys.conversations(schoolId),
    queryFn: async ({ signal }) => (await api.get<Conversation[]>(`/schools/${schoolId}/messaging/conversations`, { signal })).data,
    enabled: Boolean(schoolId) && enabled,
    // Complète la mise à jour en temps réel (socket "conversation:updated") :
    // un court `refetchInterval` de repli couvre le cas où le socket n'est
    // pas connecté (page hors de la messagerie, ex. la pastille de la
    // barre latérale) sans dépendre uniquement du push temps réel.
    refetchInterval: 30_000,
  });
}

export interface CreateConversationInput {
  type: ConversationType;
  participantUserIds: string[];
  title?: string;
}

export function useCreateConversationMutation(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateConversationInput) =>
      (await api.post<Conversation>(`/schools/${schoolId}/messaging/conversations`, input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(schoolId) }),
  });
}

const MESSAGES_PAGE_SIZE = 30;

// Historique par curseur (voir backend/src/modules/messaging/
// messaging.schema.ts::listMessagesQuerySchema) — PAS `useQuery` avec la
// pagination page/pageSize partagée du reste du projet (`utils/
// pagination.ts` côté backend) : un fil de discussion se charge par "défiler
// vers le haut pour voir plus ancien", le patron naturel de React Query pour
// ça est `useInfiniteQuery`, jamais utilisé ailleurs dans ce projet jusqu'ici
// (aucun autre module n'a ce besoin de défilement infini).
export function useMessagesQuery(schoolId: string, conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: messagingKeys.messages(schoolId, conversationId ?? ""),
    queryFn: async ({ pageParam, signal }) =>
      (
        await api.get<ListMessagesResult>(`/schools/${schoolId}/messaging/conversations/${conversationId}/messages`, {
          params: { before: pageParam, limit: MESSAGES_PAGE_SIZE },
          signal,
        })
      ).data,
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(schoolId && conversationId),
  });
}

// Insère un message dans le cache de son fil, sans dupliquer (dédoublonné
// par id) — appelée à la fois par `useSendMessageMutation`/
// `useSendAttachmentMutation` (retour direct de la requête REST) ET par
// `useMessagingSocket` (événement "message:new" poussé par le serveur, voir
// le commentaire d'en-tête ci-dessus) : les DEUX chemins peuvent livrer le
// même message (mon propre socket reçoit aussi mes propres messages, pour
// rester synchronisé entre plusieurs onglets/appareils) — jamais de doublon
// visible grâce à cette déduplication par id, quel que soit celui qui arrive
// en premier.
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

export function useSendMessageMutation(schoolId: string, conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) =>
      (await api.post<Message>(`/schools/${schoolId}/messaging/conversations/${conversationId}/messages`, { content })).data,
    onSuccess: (message) => appendMessageToCache(queryClient, schoolId, message),
  });
}

// Audit §4.4/§6 Should ("validation de type côté client, accept absent") —
// miroir CLIENT de la liste blanche serveur (backend/src/modules/messaging/
// messaging.upload.ts::ALLOWED_MIME_TYPES). Même principe que
// `features/resources/api.ts::DOCUMENT_ALLOWED_MIME_TYPES` : retour immédiat
// avant l'envoi, le serveur reste la seule source de vérité. Liste
// volontairement plus courte que celle des Ressources (pas de PowerPoint) —
// les deux listes divergent déjà côté serveur, la copie cliente suit chacune
// fidèlement plutôt que de les fusionner en une liste commune inexacte.
export const ATTACHMENT_ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip";

export const ATTACHMENT_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/zip",
]);

export function useSendAttachmentMutation(schoolId: string, conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      content,
      onUploadProgress,
    }: {
      file: File;
      content?: string;
      /** Audit §4.4/§6 Should : progression d'upload — pourcentage 0-100, non envoyé au backend. */
      onUploadProgress?: (percent: number) => void;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (content) formData.append("content", content);
      return (
        await api.post<Message>(
          `/schools/${schoolId}/messaging/conversations/${conversationId}/messages/attachment`,
          formData,
          {
            onUploadProgress: onUploadProgress
              ? (evt) => onUploadProgress(evt.total ? Math.round((evt.loaded / evt.total) * 100) : 0)
              : undefined,
          }
        )
      ).data;
    },
    onSuccess: (message) => appendMessageToCache(queryClient, schoolId, message),
  });
}

export function useMarkConversationReadMutation(schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) =>
      api.post(`/schools/${schoolId}/messaging/conversations/${conversationId}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(schoolId) }),
  });
}

export function useAddParticipantMutation(schoolId: string, conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      (await api.post<Conversation>(`/schools/${schoolId}/messaging/conversations/${conversationId}/participants`, { userId })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(schoolId) }),
  });
}

export function useRemoveParticipantMutation(schoolId: string, conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) =>
      api.delete(`/schools/${schoolId}/messaging/conversations/${conversationId}/participants/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(schoolId) }),
  });
}

export function usePresenceQuery(schoolId: string, userIds: string[]) {
  return useQuery({
    queryKey: messagingKeys.presence(schoolId, userIds),
    queryFn: async ({ signal }) =>
      (
        await api.get<PresenceInfo[]>(`/schools/${schoolId}/messaging/presence`, {
          params: { userIds: userIds.join(",") },
          signal,
        })
      ).data,
    enabled: Boolean(schoolId) && userIds.length > 0,
    // Affichage INITIAL seulement (voir le commentaire sur
    // messaging.service.ts::getPresence côté backend) — les mises à jour en
    // temps réel viennent ensuite du socket ("presence:update"), jamais
    // d'un nouveau GET répété.
    staleTime: 30_000,
  });
}

// Construit l'URL d'une pièce jointe — jamais un chemin `static` (voir le
// commentaire sur `Message.attachmentUrl` dans schema.prisma) : le
// navigateur envoie automatiquement le cookie de session sur cette requête
// same-origin (proxée par Vite en dev, voir vite.config.ts), donc une simple
// balise `<img>`/`<a>` suffit — pas besoin de passer par `api` (axios) pour
// l'afficher.
export function attachmentUrl(schoolId: string, messageId: string): string {
  return `/api/schools/${schoolId}/messaging/attachments/${messageId}`;
}
