import { ReactNode } from "react";
import {
  useMessagingSocket,
} from "@/providers/hooks/useMessagingSocket";
import { MessagingSocketContext } from "./context";


export default function MessagingSocketProvider({
  schoolId,
  children,
}: {
  schoolId: string;
  children: ReactNode;
}) {
  const state = useMessagingSocket(schoolId);
  return (
    <MessagingSocketContext.Provider value={state}>
      {children}
    </MessagingSocketContext.Provider>
  );
}


