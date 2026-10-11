import { MessagingSocketState } from "@/providers/hooks/useMessagingSocket";
import { createContext, useContext } from "react";

export const MessagingSocketContext = createContext<MessagingSocketState | undefined>(
  undefined,
);

export function useMessagingSocketContext(): MessagingSocketState {
  const ctx = useContext(MessagingSocketContext);
  if (!ctx)
    throw new Error(
      "useMessagingSocketContext doit être utilisé à l'intérieur de <MessagingSocketProvider>.",
    );
  return ctx;
}
