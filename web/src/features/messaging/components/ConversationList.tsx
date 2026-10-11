import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/types";
import { useAuth } from "@/providers/contexts/AuthContext/context";
import { useConversationsQuery } from "../api";
import { useMessagingSocketContext } from "@/providers/contexts/MessagingSocketContext/context";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card",
        online ? "bg-success" : "bg-muted-foreground/40"
      )}
      aria-hidden="true"
    />
  );
}

function ConversationAvatar({ conversation, online }: { conversation: Conversation; online: boolean }) {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {conversation.type === "GROUP" ? <Users className="size-4" /> : initials(conversation.displayName)}
      {conversation.type === "PRIVATE" && <OnlineDot online={online} />}
    </span>
  );
}

export default function ConversationList({
  schoolId,
  selectedId,
  onSelect,
  onNewConversation,
}: {
  schoolId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}) {
  const { user } = useAuth();
  const conversationsQuery = useConversationsQuery(schoolId);
  const { onlineUserIds } = useMessagingSocketContext();
  const conversations = conversationsQuery.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <h2 className="text-sm font-semibold">Conversations</h2>
        <Button size="sm" onClick={onNewConversation}>
          + Nouvelle
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversationsQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Chargement…</p>
        ) : conversations.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Aucune conversation. Cliquez sur « Nouvelle » pour écrire à quelqu'un de votre école.
          </p>
        ) : (
          conversations.map((conversation) => {
            const otherId =
              conversation.type === "PRIVATE" ? conversation.participants.find((p) => p.userId !== user?.id)?.userId : undefined;
            const online = Boolean(otherId && onlineUserIds.has(otherId));
            return (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={cn(
                  "flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors hover:bg-accent",
                  selectedId === conversation.id && "bg-accent"
                )}
              >
                <ConversationAvatar conversation={conversation} online={online} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{conversation.displayName}</span>
                    {conversation.unreadCount > 0 && (
                      <Badge className="shrink-0">{conversation.unreadCount}</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {conversation.lastMessage
                      ? `${conversation.lastMessage.senderId === user?.id ? "Vous : " : ""}${
                          conversation.lastMessage.content ?? (conversation.lastMessage.hasAttachment ? "📎 Pièce jointe" : "")
                        }`
                      : "Aucun message pour l'instant."}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
