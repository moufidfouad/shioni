import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useContactsQuery, useConversationsQuery, useCreateConversationMutation } from "@/src/api/messaging";
import { showErrorToast } from "@/src/lib/toast";
import { Conversation, MessagingContact } from "@/src/types";

// Écran "Messagerie" (Phase 2c, itération 74) — accessible depuis le
// Tableau de bord pour les TROIS profils (personnel, parent, élève) :
// `requireSchoolMemberOrGuardian` uniquement côté backend, aucune
// restriction par SchoolRole (confirmé par audit avant d'écrire cet écran),
// contrairement à Notes/Présences (personnel uniquement). Deux vues dans un
// seul fichier plutôt que deux écrans séparés : la liste des conversations
// existantes, ou (bascule `pickingContact`) la liste des contacts pour en
// démarrer une nouvelle.
//
// Itération 111 — messagerie de GROUPE (voir src/api/messaging.ts pour le
// cadrage complet). La vue "nouvelle conversation" gagne un second mode
// (`newMode`, "private" | "group") plutôt qu'un second écran séparé — même
// logique déjà en place ici pour la bascule liste/contacts, cohérente avec
// la sobriété du fichier. En mode "group" : sélection MULTIPLE de contacts
// (case à cocher simulée par un fond coché plutôt qu'une vraie `Checkbox`,
// composant absent de ce projet mobile) + un champ nom de groupe — pas de
// `SelectField`/`Checkbox` shadcn comme le web (`NewConversationDialog.tsx`),
// aucun équivalent mobile de ces composants n'existe dans ce projet.
//
// Itération 102 — DOUZIÈME écran migré vers NativeWind : `StyleSheet.
// create` → `className`, aucune valeur conditionnelle de style ici (les
// deux vues — conversations/contacts — partagent les mêmes classes `row`/
// `rowName`/`rowSub`, choix de CONTENU pas de style). Couvert par
// `messaging-attachment.yaml` (Maestro), relu avant de commencer : le flow
// tape par position (`index: 0`), jamais sur un texte propre à cet écran,
// donc insensible à ce changement de style. Nouveau flow `messaging-
// group.yaml` (itération 111) pour ce mode groupe précisément.
export default function MessagingScreen() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  const router = useRouter();
  const [pickingContact, setPickingContact] = useState(false);
  const [newMode, setNewMode] = useState<"private" | "group">("private");
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const {
    data: conversations,
    isLoading: loadingConversations,
    isError: conversationsError,
  } = useConversationsQuery(schoolId);
  const { data: contacts, isLoading: loadingContacts } = useContactsQuery(schoolId, pickingContact);
  const createConversation = useCreateConversationMutation(schoolId);

  function resetNewConversationState() {
    setPickingContact(false);
    setNewMode("private");
    setGroupTitle("");
    setSelectedIds([]);
  }

  async function startPrivateConversation(contact: MessagingContact) {
    try {
      const conversation = await createConversation.mutateAsync({
        type: "PRIVATE",
        participantUserIds: [contact.id],
      });
      resetNewConversationState();
      router.push({
        pathname: "/(app)/schools/[schoolId]/messaging/[conversationId]",
        params: { schoolId, conversationId: conversation.id },
      });
    } catch {
      showErrorToast("Impossible de démarrer cette conversation.");
    }
  }

  function toggleSelected(contactId: string) {
    setSelectedIds((current) =>
      current.includes(contactId) ? current.filter((id) => id !== contactId) : [...current, contactId]
    );
  }

  async function createGroup() {
    const title = groupTitle.trim();
    if (!title || selectedIds.length === 0) return;
    try {
      const conversation = await createConversation.mutateAsync({
        type: "GROUP",
        participantUserIds: selectedIds,
        title,
      });
      resetNewConversationState();
      router.push({
        pathname: "/(app)/schools/[schoolId]/messaging/[conversationId]",
        params: { schoolId, conversationId: conversation.id },
      });
    } catch {
      showErrorToast("Impossible de créer ce groupe.");
    }
  }

  function openConversation(conversation: Conversation) {
    router.push({
      pathname: "/(app)/schools/[schoolId]/messaging/[conversationId]",
      params: { schoolId, conversationId: conversation.id },
    });
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: "Messagerie" }} />

      <View className="px-4 pt-3">
        <Pressable
          className="mb-2 rounded-lg bg-[#eef2ff] p-3"
          onPress={() => (pickingContact ? resetNewConversationState() : setPickingContact(true))}
        >
          <Text className="font-semibold text-[#1d4ed8]">
            {pickingContact ? "← Retour aux conversations" : "Nouvelle conversation →"}
          </Text>
        </Pressable>

        {pickingContact && (
          <View className="mb-2 flex-row overflow-hidden rounded-lg border border-[#d0d0d0]">
            <Pressable
              className={`flex-1 items-center py-2 ${newMode === "private" ? "bg-[#1d4ed8]" : "bg-white"}`}
              onPress={() => setNewMode("private")}
            >
              <Text className={`text-sm font-semibold ${newMode === "private" ? "text-white" : "text-[#333]"}`}>
                Message privé
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 items-center py-2 ${newMode === "group" ? "bg-[#1d4ed8]" : "bg-white"}`}
              onPress={() => setNewMode("group")}
            >
              <Text className={`text-sm font-semibold ${newMode === "group" ? "text-white" : "text-[#333]"}`}>
                Groupe
              </Text>
            </Pressable>
          </View>
        )}

        {pickingContact && newMode === "group" && (
          <View className="mb-2">
            <TextInput
              className="rounded-lg border border-[#d0d0d0] px-3.5 py-2.5 text-[15px]"
              placeholder="Nom du groupe"
              value={groupTitle}
              onChangeText={setGroupTitle}
              maxLength={100}
            />
            <Pressable
              className={`mt-2 items-center rounded-lg bg-[#1d4ed8] py-2.5 ${
                createConversation.isPending || !groupTitle.trim() || selectedIds.length === 0 ? "opacity-50" : ""
              }`}
              onPress={createGroup}
              disabled={createConversation.isPending || !groupTitle.trim() || selectedIds.length === 0}
            >
              {createConversation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-sm font-semibold text-white">
                  Créer le groupe{selectedIds.length > 0 ? ` (${selectedIds.length} membre${selectedIds.length > 1 ? "s" : ""})` : ""}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {pickingContact ? (
        loadingContacts ? (
          <ActivityIndicator className="mt-6" />
        ) : (
          <FlatList
            data={contacts ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<Text className="mt-4 text-center text-[#999]">Aucun autre membre dans cette école.</Text>}
            renderItem={({ item }) => {
              const selected = newMode === "group" && selectedIds.includes(item.id);
              return (
                <Pressable
                  className={`mb-2 rounded-[10px] p-[14px] ${selected ? "bg-[#dbeafe]" : "bg-[#f5f7fa]"}`}
                  onPress={() => (newMode === "group" ? toggleSelected(item.id) : startPrivateConversation(item))}
                  disabled={createConversation.isPending}
                >
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-[15px] font-semibold">{item.fullName}</Text>
                      <Text className="mt-[2px] text-xs text-[#888]">{contactKindLabel(item.kind)}</Text>
                    </View>
                    {selected && <Text className="text-lg text-[#1d4ed8]">✓</Text>}
                  </View>
                </Pressable>
              );
            }}
          />
        )
      ) : loadingConversations ? (
        <ActivityIndicator className="mt-6" />
      ) : conversationsError ? (
        <Text className="mt-8 text-center text-[#c0392b]">Impossible de charger vos conversations.</Text>
      ) : (
        <FlatList
          data={conversations ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text className="mt-4 text-center text-[#999]">
              Aucune conversation pour l'instant — démarrez-en une depuis « Nouvelle conversation ».
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable className="mb-2 rounded-[10px] bg-[#f5f7fa] p-[14px]" onPress={() => openConversation(item)}>
              <View className="flex-row items-center justify-between">
                <View className="mr-2 flex-1">
                  <Text className="text-[15px] font-semibold">
                    {item.type === "GROUP" ? "👥 " : ""}
                    {item.displayName}
                  </Text>
                  <Text className="mt-[2px] text-xs text-[#888]" numberOfLines={1}>
                    {previewText(item)}
                  </Text>
                </View>
                {item.unreadCount > 0 && (
                  <View className="h-5 min-w-[20px] items-center justify-center rounded-[10px] bg-[#1d4ed8] px-[5px]">
                    <Text className="text-[11px] font-bold text-white">{item.unreadCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function contactKindLabel(kind: MessagingContact["kind"]) {
  return kind === "STAFF" ? "Personnel" : kind === "PARENT" ? "Parent" : "Élève";
}

function previewText(conversation: Conversation) {
  const message = conversation.lastMessage;
  if (!message) return "Aucun message";
  if (message.content) return message.content;
  return message.hasAttachment ? "Pièce jointe" : "Aucun message";
}
