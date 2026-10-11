import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "../api/tokenStorage";
import { SOCKET_URL } from "../config";
import { appendMessageToCache, messagingKeys } from "../api/messaging";
import { Message } from "../types";

// Phase 2c (itération 74) — miroir mobile de frontend/src/hooks/
// useMessagingSocket.ts : mêmes noms d'événements, même répartition des
// responsabilités (REST écrit, Socket.IO diffuse — voir src/api/
// messaging.ts). Deux différences structurelles avec le web :
//
// 1. Authentification : le web se connecte sans URL explicite avec
//    `withCredentials: true` (cookie httpOnly envoyé automatiquement) ; le
//    mobile n'a pas de cookie (voir src/api/client.ts, itération 69) — le
//    token d'accès est lu en SecureStore (async, d'où l'IIFE dans l'effet
//    ci-dessous) et posé dans `auth: { token }`, exactement le repli que
//    `authenticateSocket()` accepte déjà côté backend (voir
//    backend/src/modules/messaging/socket.ts, confirmé par audit avant
//    d'écrire ce fichier — AUCUN changement backend nécessaire).
// 2. Portée : un seul provider monté UNE FOIS pour tout le groupe de routes
//    `messaging/` (voir messaging/_layout.tsx), partagé par l'écran liste
//    ET l'écran fil de discussion via ce contexte — même principe que
//    MessagingSocketProvider côté web (features/messaging/
//    socket-context.tsx), pour n'ouvrir qu'UNE connexion socket pendant
//    toute la navigation dans la messagerie, fermée dès qu'on la quitte
//    (retour au Tableau de bord).
interface ServerToClientEvents {
  "message:new": (payload: Message) => void;
  "conversation:updated": (payload: { conversationId: string }) => void;
  "message:read": (payload: {
    conversationId: string;
    userId: string;
    lastReadMessageId: string;
    lastReadAt: string;
  }) => void;
  typing: (payload: { conversationId: string; userId: string; isTyping: boolean }) => void;
  "presence:update": (payload: { userId: string; online: boolean; lastSeenAt: string | null }) => void;
}

interface ClientToServerEvents {
  "typing:start": (payload: { conversationId: string }) => void;
  "typing:stop": (payload: { conversationId: string }) => void;
}

type MessagingSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface ReadReceipt {
  userId: string;
  lastReadMessageId: string;
  lastReadAt: string;
}

interface MessagingSocketState {
  connected: boolean;
  typingByConversation: Record<string, string[]>;
  readReceiptsByConversation: Record<string, Record<string, ReadReceipt>>;
  onlineUserIds: Set<string>;
  lastSeenByUser: Record<string, string | null>;
  emitTypingStart: (conversationId: string) => void;
  emitTypingStop: (conversationId: string) => void;
}

const TYPING_TIMEOUT_MS = 5000;

const MessagingSocketContext = createContext<MessagingSocketState | null>(null);

export function MessagingSocketProvider({ schoolId, children }: { schoolId: string; children: ReactNode }) {
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
    let cancelled = false;
    let socket: MessagingSocket | null = null;

    (async () => {
      const token = await getAccessToken();
      if (cancelled || !token) return;

      socket = io(SOCKET_URL, { auth: { token } });
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
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
      for (const timer of typingTimers.current.values()) clearTimeout(timer);
      typingTimers.current.clear();
    };
  }, [schoolId, queryClient]);

  const emitTypingStart = useMemo(
    () => (conversationId: string) => socketRef.current?.emit("typing:start", { conversationId }),
    []
  );
  const emitTypingStop = useMemo(
    () => (conversationId: string) => socketRef.current?.emit("typing:stop", { conversationId }),
    []
  );

  const value: MessagingSocketState = {
    connected,
    typingByConversation,
    readReceiptsByConversation,
    onlineUserIds,
    lastSeenByUser,
    emitTypingStart,
    emitTypingStop,
  };

  return <MessagingSocketContext.Provider value={value}>{children}</MessagingSocketContext.Provider>;
}

export function useMessagingSocketContext(): MessagingSocketState {
  const ctx = useContext(MessagingSocketContext);
  if (!ctx) {
    throw new Error("useMessagingSocketContext doit être utilisé sous MessagingSocketProvider.");
  }
  return ctx;
}
