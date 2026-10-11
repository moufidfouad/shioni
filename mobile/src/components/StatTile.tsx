import { StyleSheet, Text, View } from "react-native";

// Petite tuile de statistique réutilisée par le Tableau de bord (voir
// dashboard.tsx) — équivalent minimal du composant StatCard côté web
// (frontend/src/components/StatCard.tsx), sans dépendance à un design
// system RN (voir le plan mobile : ce choix reste à trancher avec
// l'utilisateur, StyleSheet natif brut en attendant).
export function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: "48%",
    backgroundColor: "#f5f7fa",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  value: { fontSize: 22, fontWeight: "700" },
  label: { fontSize: 13, color: "#555", marginTop: 2 },
  sub: { fontSize: 12, color: "#999", marginTop: 2 },
});
