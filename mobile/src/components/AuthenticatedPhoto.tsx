import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { getAccessToken } from "../api/tokenStorage";

// Phase 2d (itération 75) — miniature de photo d'identité (Élève ou
// Personnel), réutilisée par les deux modules. Piège spécifique au mobile,
// absent côté web : `GET .../photo` n'est JAMAIS servi par `express.static`
// (toujours une route authentifiée qui vérifie l'appartenance, voir
// students.service.ts/personnel.service.ts) — le web s'en sort avec une
// simple balise `<img src="...">` car le cookie de session accompagne
// automatiquement cette requête same-origin ; le mobile n'a AUCUN cookie
// (voir src/api/client.ts, itération 69), l'URL seule renverrait donc un
// 401. Solution : `<Image>` de React Native accepte un objet `headers` dans
// sa `source` réseau — on y pose l'`Authorization: Bearer` explicitement,
// lu de façon asynchrone en SecureStore (comme pour la connexion socket,
// voir src/lib/messagingSocket.tsx) plutôt que de télécharger le fichier
// sur le disque local (inutile ici, `expo-file-system` n'est nécessaire que
// pour un fichier à ouvrir avec une autre app — pas le cas d'une simple
// vignette affichée à l'écran).
export function AuthenticatedPhoto({
  uri,
  hasPhoto,
  fullName,
  size = 56,
}: {
  uri: string;
  hasPhoto?: boolean;
  fullName: string;
  size?: number;
}) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (hasPhoto) {
      getAccessToken().then((t) => {
        if (!cancelled) setToken(t);
      });
    } else {
      setToken(null);
    }
    return () => {
      cancelled = true;
    };
  }, [uri, hasPhoto]);

  const dimStyle = { width: size, height: size, borderRadius: size / 2 };

  if (hasPhoto && token) {
    return (
      <Image
        source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
        style={[styles.image, dimStyle]}
      />
    );
  }

  return (
    <View style={[styles.placeholder, dimStyle]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(fullName)}</Text>
    </View>
  );
}

// Exportée (Phase 4, itération 81) pour être testée isolément — voir
// `AuthenticatedPhoto.test.tsx` — sans changement de comportement.
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

const styles = StyleSheet.create({
  image: { backgroundColor: "#eee" },
  placeholder: { backgroundColor: "#dbe3f5", alignItems: "center", justifyContent: "center" },
  initials: { color: "#1d4ed8", fontWeight: "700" },
});
