import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSchoolQuery } from "@/src/api/schools";
import { useSchoolParametersQuery } from "@/src/api/parameters";
import { useClassRosterQuery } from "@/src/api/students";
import { useAttendanceQuery, useAttendanceStatsQuery, useBulkSetAttendanceMutation } from "@/src/api/attendance";
import { useIsOffline } from "@/src/lib/useNetworkStatus";
import { showSuccessToast } from "@/src/lib/toast";
import { AttendanceStatsRow, AttendanceStatus, Student } from "@/src/types";
import { useAuthStore } from "@/src/store/authStore";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateFr(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Écran "Présences" (personnel uniquement — Phase 2b du plan mobile).
// Itération 83 : ajoute la SAISIE (le récapitulatif seul, en lecture, date
// de l'itération 75). Deux vues, même patron que la page web
// (frontend/src/pages/school/AttendancePage.tsx) : la saisie quotidienne
// (une classe + un jour, un statut par élève — le workflow réel du cahier
// de présence) et le récapitulatif d'assiduité (déjà existant, inchangé
// ci-dessous). Un seul sélecteur de classe PARTAGÉ entre les deux vues
// (contrairement au web, qui synchronise deux composants distincts via
// l'URL) — changer d'onglet garde la classe choisie.
//
// Itération 107 — DIX-SEPTIÈME et DERNIER écran migré vers NativeWind :
// `StyleSheet.create` → `className`. Clôture la migration écran par écran
// commencée à l'itération 90 (voir mobile/README.md, "Ce qui n'est
// volontairement PAS fait" — plus aucun écran sur `StyleSheet.create`).
// Statut à TROIS branches (statusChipActiveClassName, même patron que
// feeStatusClassName à l'itération 100) pour les chips Présent/Retard/
// Absent. Seul cas de cette série où une couleur était passée en PROP
// runtime (`TotalItem({ color })`, `<Text style={[styles.totalValue,
// { color }]}>`) plutôt que fixée dans le style : les trois appelants
// passent en réalité des littéraux fixes ("#16a34a"/"#d97706"/"#c0392b"),
// donc converti en `colorClassName` (une classe Tailwind complète par
// appelant) plutôt que porter une couleur dynamique jusqu'à NativeWind,
// qui ne peut pas interpoler une prop dans une classe déjà compilée.
// Couvert par `attendance-entry.yaml` (Maestro), relu avant de commencer :
// assertions/taps sur "Saisie", "Absent" (chip), le placeholder "Motif
// (facultatif)", "Enregistrer les présences" et "Présences enregistrées."
// — aucun de ces textes ne change, seul le style.
export default function AttendanceScreen() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  const { data: school } = useSchoolQuery(schoolId);
  // Mêmes rôles que `canWrite` côté backend (attendance.routes.ts) —
  // vérifié ici UNIQUEMENT pour ne pas afficher un onglet "Saisie" voué à un
  // 403 (un ENSEIGNANT restreint à ses classes le découvre au moment de
  // choisir une classe hors de sa portée, pas avant — voir le commentaire
  // de useBulkSetAttendanceMutation) : le serveur reste la seule source de
  // vérité RBAC.
  // Itération 118 — même correctif superadmin que dashboard.tsx.
  const isSuperAdmin = Boolean(useAuthStore((s) => s.user)?.isSuperAdmin);
  const canWrite = Boolean(
    school?.myRoles?.includes("ADMIN") ||
      school?.myRoles?.includes("GESTION_ELEVES") ||
      school?.myRoles?.includes("ENSEIGNANT") ||
      isSuperAdmin
  );
  const [view, setView] = useState<"saisie" | "recap">("saisie");
  const { data: params, isLoading: loadingParams } = useSchoolParametersQuery(schoolId);
  const [groupeId, setGroupeId] = useState<string | undefined>(undefined);

  const groupeOptions = useMemo(() => {
    if (!params) return [];
    const classeById = new Map(params.classes.map((c) => [c.id, c]));
    return params.groupes
      .map((g) => ({ id: g.id, label: `${classeById.get(g.classeId)?.name ?? "?"} — ${g.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [params]);

  const effectiveView = canWrite ? view : "recap";

  return (
    <View className="flex-1 bg-white pt-3">
      <Stack.Screen options={{ title: "Présences" }} />

      {canWrite && (
        <View className="mb-2.5 flex-row gap-2 px-4">
          <Pressable
            onPress={() => setView("saisie")}
            className={`flex-1 items-center rounded-lg py-2 ${effectiveView === "saisie" ? "bg-[#1d4ed8]" : "bg-[#f0f0f0]"}`}
          >
            <Text className={`text-[13px] font-semibold ${effectiveView === "saisie" ? "text-white" : "text-[#333]"}`}>
              Saisie
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setView("recap")}
            className={`flex-1 items-center rounded-lg py-2 ${effectiveView === "recap" ? "bg-[#1d4ed8]" : "bg-[#f0f0f0]"}`}
          >
            <Text className={`text-[13px] font-semibold ${effectiveView === "recap" ? "text-white" : "text-[#333]"}`}>
              Récapitulatif
            </Text>
          </Pressable>
        </View>
      )}

      <View className="px-4">
        {loadingParams ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            horizontal
            data={groupeOptions}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = item.id === groupeId;
              return (
                <Pressable
                  onPress={() => setGroupeId(item.id)}
                  className={`mr-2 rounded-2xl px-3 py-[6px] ${isSelected ? "bg-[#1d4ed8]" : "bg-[#f0f0f0]"}`}
                >
                  <Text className={`text-[13px] ${isSelected ? "font-semibold text-white" : "text-[#333]"}`}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text className="mt-4 text-center text-[#999]">Aucune classe configurée.</Text>}
          />
        )}
      </View>

      {!groupeId ? (
        <Text className="mt-8 text-center text-[#999]">Choisissez une classe pour voir les présences.</Text>
      ) : effectiveView === "saisie" ? (
        <AttendanceEntry schoolId={schoolId} groupeId={groupeId} />
      ) : (
        <AttendanceRecap schoolId={schoolId} groupeId={groupeId} />
      )}
    </View>
  );
}

// ----------------------------------------------------------------------------
// Vue "Saisie des présences" (nouveau, itération 83)
// ----------------------------------------------------------------------------

interface Edit {
  status: AttendanceStatus;
  motif: string;
  justifiee: boolean;
}

const defaultEdit: Edit = { status: "PRESENT", motif: "", justifiee: false };

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "PRESENT", label: "Présent" },
  { value: "RETARD", label: "Retard" },
  { value: "ABSENT", label: "Absent" },
];

function AttendanceEntry({ schoolId, groupeId }: { schoolId: string; groupeId: string }) {
  const [date, setDate] = useState(todayIso());
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const isOffline = useIsOffline();

  const rosterQuery = useClassRosterQuery(schoolId, groupeId);
  const roster = rosterQuery.data ?? [];
  const attendanceQuery = useAttendanceQuery(schoolId, { groupeId, dateFrom: date, dateTo: date }, true);
  const bulkSave = useBulkSetAttendanceMutation(schoolId);

  // Repart des valeurs serveur à chaque changement de classe/date/jour
  // sélectionné, jamais d'un état d'édition partiel précédent — même
  // principe que la page web (AttendancePage.tsx::AttendanceEntry).
  // `roster.length` plutôt que `roster` en dépendance : `roster` est une
  // nouvelle référence de tableau à chaque rendu de `rosterQuery`, ce qui
  // redéclencherait l'effet (et perdrait une saisie en cours) bien plus
  // souvent que les données ne changent réellement.
  useEffect(() => {
    if (!attendanceQuery.data) {
      setEdits({});
      return;
    }
    const next: Record<string, Edit> = {};
    for (const student of roster) {
      const existing = attendanceQuery.data.find((r) => r.studentId === student.id && !r.subject);
      next[student.id] = existing
        ? { status: existing.status, motif: existing.motif ?? "", justifiee: existing.justifiee ?? false }
        : { ...defaultEdit };
    }
    setEdits(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceQuery.data, roster.length, date]);

  function updateEdit(studentId: string, patch: Partial<Edit>) {
    setEdits((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] ?? defaultEdit), ...patch } }));
  }

  async function handleSave() {
    try {
      await bulkSave.mutateAsync({
        groupeId,
        date,
        records: roster.map((s) => {
          const e = edits[s.id] ?? defaultEdit;
          return {
            studentId: s.id,
            status: e.status,
            motif: e.status === "PRESENT" ? undefined : e.motif || undefined,
            justifiee: e.status === "PRESENT" ? undefined : e.justifiee,
          };
        }),
      });
      showSuccessToast("Présences enregistrées.");
    } catch {
      // Erreur déjà affichée par le toast `onError` de la mutation
      // (useBulkSetAttendanceMutation) — rien à faire ici.
    }
  }

  const loading = rosterQuery.isLoading || attendanceQuery.isLoading;
  const saveDisabled = isOffline || bulkSave.isPending || roster.length === 0;

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-center gap-3 py-2.5">
        <Pressable onPress={() => setDate((d) => shiftDate(d, -1))} className="px-2.5 py-1" hitSlop={8}>
          <Text className="text-[22px] font-semibold text-[#1d4ed8]">‹</Text>
        </Pressable>
        <Text className="text-sm font-semibold capitalize text-[#222]">{formatDateFr(date)}</Text>
        <Pressable onPress={() => setDate((d) => shiftDate(d, 1))} className="px-2.5 py-1" hitSlop={8}>
          <Text className="text-[22px] font-semibold text-[#1d4ed8]">›</Text>
        </Pressable>
        {date !== todayIso() && (
          <Pressable onPress={() => setDate(todayIso())} className="ml-1 rounded-xl bg-[#eef2ff] px-2.5 py-1">
            <Text className="text-xs font-semibold text-[#1d4ed8]">Aujourd'hui</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator className="mt-6" />
      ) : (
        <FlatList
          data={roster}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 4 }}
          ListEmptyComponent={<Text className="mt-4 text-center text-[#999]">Aucun élève dans cette classe.</Text>}
          renderItem={({ item }) => (
            <StudentAttendanceRow
              student={item}
              edit={edits[item.id] ?? defaultEdit}
              onChange={(patch) => updateEdit(item.id, patch)}
            />
          )}
        />
      )}

      <View className="border-t border-t-[#eee] p-4 pt-2">
        {isOffline && (
          <Text className="mb-2 text-center text-xs text-[#c0392b]">Vous êtes hors ligne — l'enregistrement est indisponible.</Text>
        )}
        <Pressable
          onPress={handleSave}
          disabled={saveDisabled}
          className={`items-center rounded-[10px] py-3 ${saveDisabled ? "bg-[#9ca3af]" : "bg-[#1d4ed8]"}`}
        >
          <Text className="text-sm font-bold text-white">
            {bulkSave.isPending ? "Enregistrement…" : "Enregistrer les présences"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function StudentAttendanceRow({
  student,
  edit,
  onChange,
}: {
  student: Student;
  edit: Edit;
  onChange: (patch: Partial<Edit>) => void;
}) {
  return (
    <View className="mb-2 rounded-[10px] bg-[#f5f7fa] p-3.5">
      <View className="mb-2">
        <Text className="text-[15px] font-semibold">{student.fullName}</Text>
        <Text className="mt-[2px] text-xs text-[#888]">{student.matricule}</Text>
      </View>
      <View className="flex-row gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const active = edit.status === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange({ status: opt.value })}
              className={`flex-1 items-center rounded-lg border py-2 ${active ? statusChipActiveClassName(opt.value) : "border-[#ddd] bg-white"}`}
            >
              <Text className={`text-[13px] ${active ? "font-bold text-white" : "text-[#333]"}`}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {edit.status !== "PRESENT" && (
        <View className="mt-2.5 gap-2">
          <TextInput
            className="rounded-lg border border-[#ddd] bg-white px-2.5 py-1.5 text-[13px]"
            placeholder="Motif (facultatif)"
            value={edit.motif}
            onChangeText={(motif) => onChange({ motif })}
          />
          <Pressable onPress={() => onChange({ justifiee: !edit.justifiee })} className="flex-row items-center gap-2" hitSlop={6}>
            <View
              className={`h-[18px] w-[18px] rounded border ${edit.justifiee ? "border-[#1d4ed8] bg-[#1d4ed8]" : "border-[#999] bg-white"}`}
            />
            <Text className="text-[13px] text-[#444]">Justifiée</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function statusChipActiveClassName(status: AttendanceStatus) {
  return status === "PRESENT"
    ? "bg-[#16a34a] border-[#16a34a]"
    : status === "RETARD"
      ? "bg-[#d97706] border-[#d97706]"
      : "bg-[#c0392b] border-[#c0392b]";
}

// ----------------------------------------------------------------------------
// Vue "Récapitulatif" (itération 75, inchangée — voir stats par classe)
// ----------------------------------------------------------------------------

// Raccourcis de période (itération 86) — PAS un vrai calendrier (aucune
// librairie de date picker introduite, même choix assumé que la Saisie).
// `days: null` = historique complet (comportement d'origine, sans
// dateFrom/dateTo) ; sinon les `days` derniers jours jusqu'à aujourd'hui.
const RECAP_PERIODS: { label: string; days: number | null }[] = [
  { label: "Tout", days: null },
  { label: "7 derniers jours", days: 7 },
  { label: "30 derniers jours", days: 30 },
  { label: "90 derniers jours", days: 90 },
];

function AttendanceRecap({ schoolId, groupeId }: { schoolId: string; groupeId: string }) {
  const [periodDays, setPeriodDays] = useState<number | null>(null);
  const dateTo = periodDays != null ? todayIso() : undefined;
  const dateFrom = periodDays != null ? shiftDate(todayIso(), -periodDays) : undefined;

  const { data: stats, isLoading, isError } = useAttendanceStatsQuery(schoolId, groupeId, dateFrom, dateTo);

  return (
    <View className="flex-1">
      <View className="mb-2.5 px-4">
        <FlatList
          horizontal
          data={RECAP_PERIODS}
          keyExtractor={(item) => item.label}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const isActive = periodDays === item.days;
            return (
              <Pressable
                onPress={() => setPeriodDays(item.days)}
                className={`mr-2 rounded-2xl border px-3 py-[6px] ${isActive ? "border-[#1d4ed8] bg-[#1d4ed8]" : "border-[#c7d2fe] bg-[#eef2ff]"}`}
              >
                <Text className={`text-xs font-semibold ${isActive ? "text-white" : "text-[#1d4ed8]"}`}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-6" />
      ) : isError || !stats ? (
        <Text className="mt-8 text-center text-[#c0392b]">Impossible de charger les présences.</Text>
      ) : (
        <FlatList
          data={stats.students}
          keyExtractor={(item) => item.student.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 4 }}
          ListHeaderComponent={
            <View className="mb-3 flex-row justify-around rounded-[10px] bg-[#f5f7fa] py-3">
              <TotalItem label="Présents" value={stats.totals.present} colorClassName="text-[#16a34a]" />
              <TotalItem label="Retards" value={stats.totals.retard} colorClassName="text-[#d97706]" />
              <TotalItem label="Absents" value={stats.totals.absent} colorClassName="text-[#c0392b]" />
            </View>
          }
          ListEmptyComponent={<Text className="mt-4 text-center text-[#999]">Aucun enregistrement pour cette classe.</Text>}
          renderItem={({ item }: { item: AttendanceStatsRow }) => (
            <View className="mb-2 flex-row items-center justify-between rounded-[10px] bg-[#f5f7fa] p-3.5">
              <View>
                <Text className="text-[15px] font-semibold">{item.student.fullName}</Text>
                <Text className="mt-[2px] text-xs text-[#888]">{item.student.matricule}</Text>
              </View>
              <View className="items-end">
                <Text className="text-base font-bold">
                  {item.tauxPresence != null ? `${item.tauxPresence.toFixed(0)} %` : "—"}
                </Text>
                <Text className="mt-[2px] text-[11px] text-[#666]">
                  {item.present} prés. · {item.retard} ret. · {item.absent} abs.
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function TotalItem({ label, value, colorClassName }: { label: string; value: number; colorClassName: string }) {
  return (
    <View className="items-center">
      <Text className={`text-lg font-bold ${colorClassName}`}>{value}</Text>
      <Text className="text-xs text-[#666]">{label}</Text>
    </View>
  );
}
