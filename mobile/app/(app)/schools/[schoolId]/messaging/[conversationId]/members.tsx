import { useMemo } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  useAddParticipantMutation,
  useContactsQuery,
  useConversationQuery,
  useRemoveParticipantMutation,
} from "@/src/api/messaging";
import { showErrorToast, showSuccessToast } from "@/src/lib/toast";
import { ConversationParticipant, MessagingContact } from "@/src/types";

// Écran "Membres du groupe" (itération 111) — miroir mobile de
// frontend/src/features/messaging/components/ParticipantsDialog.tsx, en
// écran de navigation plutôt qu'en dialogue modal : ce projet mobile n'a
// jamais introduit `Modal`/une bibliothèque de dialogue (voir
// `presentPhotoSourceOptions`, qui se contente d'un `Alert.alert` natif pour
// un simple choix caméra/galerie — insuffisant ici pour une liste
// scrollable + un formulaire) ; un écran séparé atteint par
// `router.push` reprend exactement le patron déjà établi pour tout autre
// écran de détail de ce projet (`children/[studentId]/timetable.tsx`,
// `personnel/[staffId].tsx`...), plutôt que d'introduire un nouveau
// mécanisme UI pour ce seul cas.
//
// Atteignable UNIQUEMENT depuis le bouton "Membres" de `[conversationId]/
// index.tsx`, lui-même conditionné à `conversation.myRole === "ADMIN"` — cet
// écran ne revérifie donc pas ce rôle lui-même côté affichage (même choix
// que `ParticipantsDialog.tsx`, qui ne le revérifie pas non plus) ; le
// backend reste le seul rempart réel (`messaging.service.ts::
// assertGroupAdmin`), à chaque appel d'`useAddParticipantMutation`/
// `useRemoveParticipantMutation`.
//
// Retrait : confirmation via `Alert.alert` (style destructif) avant
// d'appeler la mutation — même texte que `ConfirmDialog` du web
// ("Retirer ce membre ?" / "Il ne recevra plus les messages de ce
// groupe."). Ajout : liste des contacts NON déjà membres, ajoutés d'un tap
// direct (pas de `SelectField` — composant absent de ce projet mobile,
// contrairement au web) — cohérent avec le patron déjà en place pour
// démarrer une conversation privée (`messaging/index.tsx`, tap sur un
// contact).
export default function GroupMembersScreen() {
  const { schoolId, conversationId } = useLocalSearchParams<{ schoolId: string; conversationId: string }>();

  const conversationQuery = useConversationQuery(schoolId, conversationId);
  const conversation = conversationQuery.data;
  const contactsQuery = useContactsQuery(schoolId, true);
  const addParticipant = useAddParticipantMutation(schoolId, conversationId);
  const removeParticipant = useRemoveParticipantMutation(schoolId, conversationId);

  const participantIds = useMemo(
    () => new Set(conversation?.participants.map((p) => p.userId) ?? []),
    [conversation?.participants]
  );
  const addableContacts = useMemo(
    () => (contactsQuery.data ?? []).filter((c) => !participantIds.has(c.id)),
    [contactsQuery.data, participantIds]
  );

  function confirmRemove(participant: ConversationParticipant) {
    Alert.alert("Retirer ce membre ?", "Il ne recevra plus les messages de ce groupe.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: async () => {
          try {
            await removeParticipant.mutateAsync(participant.userId);
            showSuccessToast("Membre retiré.");
          } catch {
            showErrorToast("Retrait impossible.");
          }
        },
      },
    ]);
  }

  async function addContact(contact: MessagingContact) {
    try {
      await addParticipant.mutateAsync(contact.id);
      showSuccessToast("Membre ajouté.");
    } catch {
      showErrorToast("Ajout impossible.");
    }
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: "Membres du groupe" }} />

      {conversationQuery.isLoading ? (
        <ActivityIndicator className="mt-6" />
      ) : (
        <FlatList
          data={conversation?.participants ?? []}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={<Text className="mb-2 text-xs font-semibold uppercase text-[#888]">Membres actuels</Text>}
          renderItem={({ item }) => (
            <View className="mb-2 flex-row items-center justify-between rounded-[10px] bg-[#f5f7fa] p-[14px]">
              <View className="mr-2 flex-1 flex-row items-center">
                <Text className="flex-1 text-[15px] font-semibold" numberOfLines={1}>
                  {item.fullName}
                </Text>
                {item.role === "ADMIN" && (
                  <View className="ml-2 rounded-full bg-[#e0e7ff] px-2 py-[2px]">
                    <Text className="text-[11px] font-semibold text-[#1d4ed8]">Admin</Text>
                  </View>
                )}
              </View>
              <Pressable
                className="ml-2 px-2 py-1"
                onPress={() => confirmRemove(item)}
                disabled={removeParticipant.isPending}
              >
                <Text className="text-sm font-semibold text-[#c0392b]">Retirer</Text>
              </Pressable>
            </View>
          )}
          ListFooterComponent={
            <View className="mt-4">
              <Text className="mb-2 text-xs font-semibold uppercase text-[#888]">Ajouter un membre</Text>
              {contactsQuery.isLoading ? (
                <ActivityIndicator />
              ) : addableContacts.length === 0 ? (
                <Text className="text-center text-[#999]">Tous les contacts de l'école sont déjà membres.</Text>
              ) : (
                addableContacts.map((contact) => (
                  <Pressable
                    key={contact.id}
                    className="mb-2 flex-row items-center justify-between rounded-[10px] bg-[#eef2ff] p-[14px]"
                    onPress={() => addContact(contact)}
                    disabled={addParticipant.isPending}
                  >
                    <Text className="text-[15px] font-semibold text-[#1d4ed8]">{contact.fullName}</Text>
                    <Text className="text-lg text-[#1d4ed8]">+</Text>
                  </Pressable>
                ))
              )}
            </View>
          }
        />
      )}
    </View>
  );
}
