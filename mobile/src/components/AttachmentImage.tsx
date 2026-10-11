import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { getAccessToken } from "../api/tokenStorage";
import { messageAttachmentUrl } from "../api/messaging";

// Itération 85 — affichage inline d'une pièce jointe IMAGE dans une bulle de
// message (voir messaging/[conversationId].tsx::MessageBubble). Même piège/
// solution qu'AuthenticatedPhoto.tsx (itération 75) : `GET .../
// attachments/:messageId` n'est JAMAIS servi par `express.static` (vérifie
// l'appartenance à la conversation, voir messaging.controller.ts::
// downloadAttachment) — un simple `<Image source={{ uri }}>` renverrait un
// 401, l'`Authorization: Bearer` doit accompagner explicitement la requête
// réseau de l'`<Image>`.
export function AttachmentImage({ schoolId, messageId }: { schoolId: string; messageId: string }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAccessToken().then((t) => {
      if (!cancelled) setToken(t);
    });
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  if (!token) {
    return (
      <View style={[styles.image, styles.placeholder]}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: messageAttachmentUrl(schoolId, messageId), headers: { Authorization: `Bearer ${token}` } }}
      style={styles.image}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  image: { width: 220, height: 160, borderRadius: 10, backgroundColor: "#e5e7eb" },
  placeholder: { alignItems: "center", justifyContent: "center" },
});
