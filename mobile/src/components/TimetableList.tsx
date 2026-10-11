import { StyleSheet, Text, View } from "react-native";
import { TIMETABLE_DAYS, TimetableEntry } from "../types";

// Rendu d'un emploi du temps — réutilisé par les TROIS profils (personnel :
// timetable.tsx ; parent : children/[studentId]/timetable.tsx ; élève :
// timetable.tsx, branche élève) : même forme de donnée (`TimetableEntry[]`)
// dans les trois cas via trois routes backend différentes mais identiques
// en sortie (voir timetable.service.ts::listTimetable, réutilisé tel quel
// par les deux nouveaux endpoints portail de l'itération 72). Même principe
// que BulletinView.tsx (itération 70) : un seul composant de rendu.
//
// Regroupé par jour (le backend trie déjà par jour puis heure, voir
// listTimetable::sortEntries) — un simple regroupement en JS suffit, pas
// besoin de retrier ici.
export function TimetableList({ entries }: { entries: TimetableEntry[] }) {
  if (entries.length === 0) {
    return <Text style={styles.empty}>Aucun créneau programmé.</Text>;
  }

  const byDay = new Map<string, TimetableEntry[]>();
  for (const entry of entries) {
    const list = byDay.get(entry.day) ?? [];
    list.push(entry);
    byDay.set(entry.day, list);
  }

  return (
    <View>
      {TIMETABLE_DAYS.filter((day) => byDay.has(day)).map((day) => (
        <View key={day} style={styles.daySection}>
          <Text style={styles.dayTitle}>{day}</Text>
          {byDay.get(day)!.map((entry) => (
            <View key={entry.id} style={styles.entry}>
              <View style={styles.timeColumn}>
                <Text style={styles.time}>{entry.startTime}</Text>
                <Text style={styles.time}>{entry.endTime}</Text>
              </View>
              <View style={styles.details}>
                <Text style={styles.subject}>{entry.subjectName ?? "Matière non renseignée"}</Text>
                <Text style={styles.meta}>
                  {entry.groupe.name}
                  {entry.teacherName ? ` — ${entry.teacherName}` : ""}
                  {entry.salle ? ` — ${entry.salle.name}` : ""}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: "#999", fontStyle: "italic", marginTop: 8 },
  daySection: { marginBottom: 16 },
  dayTitle: { fontSize: 14, fontWeight: "700", color: "#1d4ed8", marginBottom: 6 },
  entry: {
    flexDirection: "row",
    backgroundColor: "#f5f7fa",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  timeColumn: { width: 64, marginRight: 12 },
  time: { fontSize: 12, color: "#666" },
  details: { flex: 1 },
  subject: { fontSize: 15, fontWeight: "600" },
  meta: { fontSize: 12, color: "#888", marginTop: 2 },
});
