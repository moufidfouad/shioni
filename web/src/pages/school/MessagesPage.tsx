import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { SchoolOutletContext } from "@/layouts/school/SchoolLayout";
import ConversationList from "@/features/messaging/components/ConversationList";
import ChatWindow from "@/features/messaging/components/ChatWindow";
import NewConversationDialog from "@/features/messaging/components/NewConversationDialog";
import ParticipantsDialog from "@/features/messaging/components/ParticipantsDialog";
import PageHeader from "@/components/PageHeader";
import PageTransition from "@/components/motion/PageTransition";
import { cn } from "@/lib/utils";
import MessagingSocketProvider from "@/providers/contexts/MessagingSocketContext";

export default function MessagesPage() {
  const { school } = useOutletContext<SchoolOutletContext>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  return (
    <MessagingSocketProvider schoolId={school.id}>
      <PageTransition className="flex h-[calc(100vh-8rem)] flex-col gap-4">
        <PageHeader
          title="Messagerie"
          description="Discutez en temps réel avec les membres de votre école."
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-xl border md:grid-cols-[300px_1fr]">
          <div
            className={cn(
              "min-h-0 border-r md:block",
              selectedId ? "hidden" : "block",
            )}
          >
            <ConversationList
              schoolId={school.id}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onNewConversation={() => setShowNewConversation(true)}
            />
          </div>
          <div
            className={cn("min-h-0 md:block", selectedId ? "block" : "hidden")}
          >
            {selectedId ? (
              <ChatWindow
                schoolId={school.id}
                conversationId={selectedId}
                onManageParticipants={() => setShowParticipants(true)}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                Sélectionnez une conversation, ou créez-en une nouvelle.
              </div>
            )}
          </div>
        </div>

        {/* Retour à la liste sur mobile (la grille ci-dessus masque l'une des
            deux colonnes selon la sélection en dessous de `md`). */}
        {selectedId && (
          <button
            type="button"
            className="text-left text-sm text-muted-foreground underline md:hidden"
            onClick={() => setSelectedId(null)}
          >
            ← Retour aux conversations
          </button>
        )}
      </PageTransition>

      <NewConversationDialog
        schoolId={school.id}
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        onCreated={(id) => setSelectedId(id)}
      />

      {selectedId && (
        <ParticipantsDialog
          schoolId={school.id}
          conversationId={selectedId}
          open={showParticipants}
          onOpenChange={setShowParticipants}
        />
      )}
    </MessagingSocketProvider>
  );
}
