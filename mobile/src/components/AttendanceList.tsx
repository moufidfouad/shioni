import { StyleSheet, Text, View } from "react-native";
import { AttendanceRecord } from "../types";

// Rendu d'un historique de présences — réutilisé par le portail Parent
// (children/[studentId]/index.tsx) ET le portail Élève
// (dashboard.tsx::StudentDashboard) : même forme de donnée
// (`AttendanceRecord[]`, historique COMPLET d'un seul élève — voir
// attendance.service.ts::listAllAttendance) dans les deux cas, un seul
// composant plutôt que deux copies — même principe que BulletinView.tsx
// (itération 70). Ne sert PAS à l'écran Présences du personnel (plusieurs
// élèves à la fois, vue par statistiques — voir AttendanceStats dans
// attendance.tsx), qui a son propre rendu.
export function AttendanceList({ records }: { records: AttendanceRecord[] }) {
  if (records.length === 0) {
    return <Text style={styles.empty}>Aucun enregistrement de présence.</Text>;
  }

  return (
    <View>
      {records.map((r) => (
        <View key={r.id} style={styles.row}>
          <View>
            <Text style={styles.date}>{new Date(r.date).toLocaleDateString("fr-FR")}</Text>
            {r.subject && <Text style={styles.subject}>{r.subject}</Text>}
          </View>
          <Text style={[styles.status, statusStyle(r.status)]}>{statusLabel(r.status)}</Text>
        </View>
      ))}
    </View>
  );
}

function statusLabel(status: AttendanceRecord["status"]) {
  return status === "PRESENT" ? "Présent" : status === "RETARD" ? "Retard" : "Absent";
}

function statusStyle(status: AttendanceRecord["status"]) {
  return status === "PRESENT" ? styles.present : status === "RETARD" ? styles.retard : styles.absent;
}

const styles = StyleSheet.create({
  empty: { color: "#999", fontStyle: "italic", marginTop: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  date: { fontSize: 13, color: "#444" },
  subject: { fontSize: 12, color: "#999", marginTop: 2 },
  status: { fontSize: 13, fontWeight: "600" },
  present: { color: "#16a34a" },
  retard: { color: "#d97706" },
  absent: { color: "#c0392b" },
});
