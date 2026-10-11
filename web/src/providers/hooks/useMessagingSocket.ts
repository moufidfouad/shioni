import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { Message } from "@/types";
import { appendMessageToCache, messagingKeys } from "@/features/messaging/api";


interface ServerToClientEvents {
  "message:new": (payload: Message) => void;
  "conversation:updated": (payload: { conversationId: string }) => void;
  "message:read": (payload: { conversationId: string; userId: string; lastReadMessageId: string; lastReadAt: string }) => void;
  typing: (payload: { conversationId: string; userId: string; isTyping: boolean }) => void;
  "presence:update": (payload: { userId: string; online: boolean; lastSeenAt: string | null }) => void;
}

interface ClientToServerEvents {
  "typing:start": (payload: { conversationId: string }) => void;
  "typing:stop": (payload: { conversationId: string }) => void;
}

type MessagingSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface ReadReceipt {
  userId: string;
  lastReadMessageId: string;
  lastReadAt: string;
}

export interface MessagingSocketState {
  connected: boolean;
  /** Ids des conversations où au moins un AUTRE participant est en train de saisir. */
  typingByConversation: Record<string, string[]>;
  /** Dernier accusé de lecture connu par utilisateur, pour chaque conversation. */
  readReceiptsByConversation: Record<string, Record<string, ReadReceipt>>;
  onlineUserIds: Set<string>;
  lastSeenByUser: Record<string, string | null>;
  emitTypingStart: (conversationId: string) => void;
  emitTypingStop: (conversationId: string) => void;
}

// Un seul timer d'auto-expiration par (conversation, utilisateur) — un
// "typing:stop" peut se perdre (l'autre utilisateur ferme l'onglet sans
// jamais l'émettre) : sans ce filet, l'indicateur "en train d'écrire…»
// resterait affiché indéfiniment.
const TYPING_TIMEOUT_MS = 5000;

export function useMessagingSocket(schoolId: string | undefined): MessagingSocketState {
  const queryClient = useQueryClient();
  const socketRef = useRef<MessagingSocket | null>(null);
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const [connected, setConnected] = useState(false);
  const [typingByConversation, setTypingByConversation] = useState<Record<string, string[]>>({});
  const [readReceiptsByConversation, setReadReceiptsByConversation] = useState<
    Record<string, Record<string, ReadReceipt>>
  >({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [lastSeenByUser, setLastSeenByUser] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!schoolId) return;

    // Chemin/hôte par défaut de socket.io-client (même origine que la page)
    // — en dev, le proxy Vite relaie "/socket.io" en WebSocket (voir
    // vite.config.ts, `ws: true`) ; en prod, frontend et backend partagent
    // la même origine derrière le reverse proxy (même hypothèse que `api`,
    // voir src/api/client.ts). `withCredentials: true` fait envoyer le
    // cookie de session httpOnly sur la poignée de main, exactement comme
    // `withCredentials` côté axios — c'est ce cookie que `socket.ts` (
    // backend) authentifie (voir `authenticateSocket`).
    const socket: MessagingSocket = io({ withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("message:new", (message) => {
      appendMessageToCache(queryClient, schoolId, message);
    });

    socket.on("conversation:updated", () => {
      queryClient.invalidateQueries({ queryKey: messagingKeys.conversations(schoolId) });
    });

    socket.on("message:read", ({ conversationId, userId, lastReadMessageId, lastReadAt }) => {
      setReadReceiptsByConversation((prev) => ({
        ...prev,
        [conversationId]: { ...prev[conversationId], [userId]: { userId, lastReadMessageId, lastReadAt } },
      }));
    });

    socket.on("typing", ({ conversationId, userId, isTyping }) => {
      const timerKey = `${conversationId}:${userId}`;
      const existingTimer = typingTimers.current.get(timerKey);
      if (existingTimer) clearTimeout(existingTimer);

      setTypingByConversation((prev) => {
        const current = new Set(prev[conversationId] ?? []);
        if (isTyping) current.add(userId);
        else current.delete(userId);
        return { ...prev, [conversationId]: [...current] };
      });

      if (isTyping) {
        typingTimers.current.set(
          timerKey,
          setTimeout(() => {
            setTypingByConversation((prev) => ({
              ...prev,
              [conversationId]: (prev[conversationId] ?? []).filter((id) => id !== userId),
            }));
          }, TYPING_TIMEOUT_MS)
        );
      }
    });

    socket.on("presence:update", ({ userId, online, lastSeenAt }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
      setLastSeenByUser((prev) => ({ ...prev, [userId]: lastSeenAt }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      for (const timer of typingTimers.current.values()) clearTimeout(timer);
      typingTimers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const emitTypingStart = useMemo(
    () => (conversationId: string) => socketRef.current?.emit("typing:start", { conversationId }),
    []
  );
  const emitTypingStop = useMemo(
    () => (conversationId: string) => socketRef.current?.emit("typing:stop", { conversationId }),
    []
  );

  return {
    connected,
    typingByConversation,
    readReceiptsByConversation,
    onlineUserIds,
    lastSeenByUser,
    emitTypingStart,
    emitTypingStop,
  };
}
