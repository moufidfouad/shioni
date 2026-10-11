import { StyleSheet, Text, View } from "react-native";
import { Bulletin } from "../types";

// Rendu du bulletin d'un trimestre — réutilisé par l'écran "Notes" du
// personnel (bulletin/[studentId].tsx) ET par les portails Parent/Élève
// (children/[studentId].tsx, dashboard.tsx côté Élève) : même forme de
// donnée (`Bulletin`) dans les trois cas, un seul composant de rendu plutôt
// que trois copies — équivalent mobile de
// frontend/src/components/BulletinTable.tsx.
export function BulletinView({ bulletin }: { bulletin: Bulletin | null }) {
  if (!bulletin) {
    return <Text style={styles.empty}>Aucune note saisie pour ce trimestre.</Text>;
  }

  return (
    <View>
      <View style={styles.summaryRow}>
        <SummaryItem label="Moyenne" value={bulletin.average != null ? bulletin.average.toFixed(2) : "—"} />
        <SummaryItem
          label="Rang"
          value={bulletin.rank != null ? `${bulletin.rank} / ${bulletin.classSize}` : "—"}
        />
        <SummaryItem label="Mention" value={bulletin.mention ?? "—"} />
      </View>

      {bulletin.subjects.map((subject) => (
        <View key={subject.subjectId} style={styles.subjectRow}>
          <View style={styles.subjectHeader}>
            <Text style={styles.subjectName}>{subject.subjectName}</Text>
            <Text style={styles.subjectAverage}>
              {subject.average != null ? subject.average.toFixed(2) : "—"}
            </Text>
          </View>
          <Text style={styles.coefficient}>Coefficient {subject.coefficient}</Text>
          {subject.evaluations.map((evaluation) => (
            <Text key={evaluation.id} style={styles.evaluation}>
              {evaluation.label} : {evaluation.value} (poids {evaluation.weight})
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: "#999", fontStyle: "italic", marginTop: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryValue: { fontSize: 20, fontWeight: "700" },
  summaryLabel: { fontSize: 12, color: "#666" },
  subjectRow: { borderTopWidth: 1, borderTopColor: "#eee", paddingVertical: 10 },
  subjectHeader: { flexDirection: "row", justifyContent: "space-between" },
  subjectName: { fontWeight: "600", fontSize: 15 },
  subjectAverage: { fontWeight: "700", fontSize: 15 },
  coefficient: { fontSize: 12, color: "#888", marginTop: 2 },
  evaluation: { fontSize: 13, color: "#555", marginTop: 4 },
});
