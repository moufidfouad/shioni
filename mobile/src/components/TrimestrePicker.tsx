import { Pressable, StyleSheet, Text, View } from "react-native";

// Sélecteur de trimestre — équivalent minimal du <Select> web
// (ParentPortalPage.tsx/GradesPage.tsx utilisent un composant shadcn/ui,
// non portable tel quel, voir la table de réutilisation du plan mobile).
export function TrimestrePicker({
  value,
  count,
  onChange,
}: {
  value: number;
  count: number;
  onChange: (trimestre: number) => void;
}) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, i) => i + 1).map((t) => (
        <Pressable
          key={t}
          onPress={() => onChange(t)}
          style={[styles.pill, t === value && styles.pillActive]}
        >
          <Text style={[styles.pillText, t === value && styles.pillTextActive]}>Trimestre {t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginBottom: 16 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },
  pillActive: { backgroundColor: "#1d4ed8" },
  pillText: { fontSize: 13, color: "#333" },
  pillTextActive: { color: "#fff", fontWeight: "600" },
});
