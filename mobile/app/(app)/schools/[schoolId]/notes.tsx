import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSchoolQuery } from "@/src/api/schools";
import { useSchoolParametersQuery } from "@/src/api/parameters";
import { useClassRosterQuery } from "@/src/api/students";
import { useSubjectsQuery } from "@/src/api/subjects";
import { useMyTeachingScopeQuery } from "@/src/api/me";
import { useBulkSetGradeEvaluationMutation, useGradesQuery, useRankingQuery } from "@/src/api/grades";
import { useIsOffline } from "@/src/lib/useNetworkStatus";
import { showErrorToast, showSuccessToast } from "@/src/lib/toast";
import { TrimestrePicker } from "@/src/components/TrimestrePicker";
import { RankingRow, Student, Subject } from "@/src/types";
import { useAuthStore } from "@/src/store/authStore";

// Écran "Notes" (personnel uniquement — accessible depuis le Tableau de
// bord, voir dashboard.tsx::StaffDashboard). Phase 2a du plan mobile a livré
// le classement + bulletin en lecture seule (itération 70). Itération 83
// ajoute la SAISIE (une classe + une matière + un trimestre + UNE
// évaluation à la fois — reflète le contrat exact de l'endpoint `bulk`,
// voir grades.ts). Simplification assumée par rapport au web
// (GradesPage.tsx, une matrice de TOUTES les évaluations éditable en une
// fois) : ici une évaluation à la fois, choisie parmi celles déjà saisies
// (chips) ou nouvelle (libellé libre) — plus simple à saisir juste et à
// vérifier correctement sur mobile qu'une matrice complète, même principe
// de réduction de périmètre que la Présence (itération 83, pas de champ
// "heure").
//
// Simplification déjà assumée à l'itération 75 (Présences) et reprise ici :
// sélecteur de classe en LISTE PLATE "Classe — Groupe" plutôt que la
// cascade Cycle → Classe → Série → Groupe du web.
//
// Itération 106 — SEIZIÈME écran migré vers NativeWind : `StyleSheet.
// create` → `className`. Trois familles de pastilles/onglets
// conditionnelles (onglets Saisie/Classement, pastilles de classe/matière,
// chips d'évaluation existante) reprennent le patron établi à l'itération
// 95 : une seule classe complète choisie par branche, jamais deux classes
// empilées. Couvert par `grades-entry.yaml` (Maestro), relu avant de
// commencer : assertions/taps sur "Saisie", les placeholders "Libellé
// (ex. Devoir 1)"/"Poids (ex. 25)"/"—", et "Enregistrer les notes" —
// aucun de ces textes ne change, seul le style.
export default function NotesScreen() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  const router = useRouter();
  const { data: school } = useSchoolQuery(schoolId);
  // Mêmes rôles que `canWrite` côté backend (grades.routes.ts) — vérifié ici
  // UNIQUEMENT pour ne pas afficher un onglet "Saisie" voué à un 403, même
  // patron que Présences (itération 83) et la photo éditable (itération 80).
  // Itération 118 — même correctif superadmin que dashboard.tsx.
  const isSuperAdmin = Boolean(useAuthStore((s) => s.user)?.isSuperAdmin);
  const canWrite = Boolean(
    school?.myRoles?.includes("ADMIN") ||
      school?.myRoles?.includes("GESTION_NOTES") ||
      school?.myRoles?.includes("ENSEIGNANT") ||
      isSuperAdmin
  );
  const [view, setView] = useState<"saisie" | "classement">("saisie");
  const effectiveView = canWrite ? view : "classement";

  const { data: params, isLoading: loadingParams } = useSchoolParametersQuery(schoolId);
  const [groupeId, setGroupeId] = useState<string | undefined>(undefined);
  const [trimestre, setTrimestre] = useState(1);

  const groupeOptions = useMemo(() => {
    if (!params) return [];
    const classeById = new Map(params.classes.map((c) => [c.id, c]));
    return params.groupes
      .map((g) => ({ id: g.id, label: `${classeById.get(g.classeId)?.name ?? "?"} — ${g.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [params]);

  return (
    <View className="flex-1 bg-white pt-3">
      <Stack.Screen options={{ title: "Notes" }} />

      {canWrite && (
        <View className="mb-[10px] flex-row gap-2 px-4">
          <Pressable
            onPress={() => setView("saisie")}
            className={`flex-1 items-center rounded-lg py-2 ${effectiveView === "saisie" ? "bg-[#1d4ed8]" : "bg-[#f0f0f0]"}`}
          >
            <Text className={`text-[13px] font-semibold ${effectiveView === "saisie" ? "text-white" : "text-[#333]"}`}>
              Saisie
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setView("classement")}
            className={`flex-1 items-center rounded-lg py-2 ${effectiveView === "classement" ? "bg-[#1d4ed8]" : "bg-[#f0f0f0]"}`}
          >
            <Text
              className={`text-[13px] font-semibold ${effectiveView === "classement" ? "text-white" : "text-[#333]"}`}
            >
              Classement
            </Text>
          </Pressable>
        </View>
      )}

      <View className="px-4">
        <TrimestrePicker value={trimestre} count={params?.nbTrimestres ?? 3} onChange={setTrimestre} />

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
        <Text className="mt-8 text-center text-[#999]">Choisissez une classe.</Text>
      ) : effectiveView === "saisie" ? (
        <GradesEntry schoolId={schoolId} groupeId={groupeId} trimestre={trimestre} />
      ) : (
        <GradesRanking schoolId={schoolId} groupeId={groupeId} trimestre={trimestre} router={router} />
      )}
    </View>
  );
}

// ----------------------------------------------------------------------------
// Vue "Saisie de notes" (nouveau, itération 83)
// ----------------------------------------------------------------------------

function GradesEntry({ schoolId, groupeId, trimestre }: { schoolId: string; groupeId: string; trimestre: number }) {
  const isOffline = useIsOffline();
  const rosterQuery = useClassRosterQuery(schoolId, groupeId);
  const roster = rosterQuery.data ?? [];
  const subjectsQuery = useSubjectsQuery(schoolId);
  const scopeQuery = useMyTeachingScopeQuery(schoolId);

  // Matières RÉELLEMENT enseignées dans cette classe (coefficient déclaré
  // pour ce `groupeId`), puis restreintes à celles de la portée de
  // l'utilisateur s'il est un ENSEIGNANT restreint (voir api/me.ts) — même
  // double filtre que la page web (GradesPage.tsx).
  const subjectOptions = useMemo(() => {
    const forClass = (subjectsQuery.data ?? []).filter((s) => s.coefficients.some((c) => c.groupeId === groupeId));
    const scope = scopeQuery.data;
    if (!scope || !scope.restricted) return forClass;
    const allowed = new Set(scope.assignments.filter((a) => a.groupeId === groupeId).map((a) => a.subjectId));
    return forClass.filter((s) => allowed.has(s.id));
  }, [subjectsQuery.data, scopeQuery.data, groupeId]);

  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (subjectId && !subjectOptions.some((s) => s.id === subjectId)) setSubjectId(undefined);
  }, [subjectOptions, subjectId]);

  const gradesQuery = useGradesQuery(schoolId, { groupeId, subjectId, trimestre }, Boolean(subjectId));
  const bulkSave = useBulkSetGradeEvaluationMutation(schoolId);

  // Libellés d'évaluation déjà saisis pour cette classe/matière/trimestre,
  // dans leur ordre de première apparition — proposés en raccourci pour
  // reprendre/corriger une évaluation existante plutôt que d'en retaper le
  // libellé exact (une faute de frappe créerait une évaluation en double,
  // voir grades.service.ts::bulkSetGradeEvaluation).
  const existingLabels = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const grade of gradesQuery.data ?? []) {
      for (const ev of grade.evaluations) {
        if (!seen.has(ev.label)) {
          seen.add(ev.label);
          order.push(ev.label);
        }
      }
    }
    return order;
  }, [gradesQuery.data]);

  const [label, setLabel] = useState("");
  const [weight, setWeight] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  // Repart d'une évaluation vierge à chaque changement de classe/matière/
  // trimestre — jamais d'une saisie en cours qui ne correspondrait plus au
  // contexte affiché.
  useEffect(() => {
    setLabel("");
    setWeight("");
    setValues({});
  }, [groupeId, subjectId, trimestre]);

  function selectExistingLabel(selected: string) {
    setLabel(selected);
    let foundWeight = "";
    const nextValues: Record<string, string> = {};
    for (const grade of gradesQuery.data ?? []) {
      const ev = grade.evaluations.find((e) => e.label === selected);
      if (ev) {
        if (!foundWeight) foundWeight = ev.weight;
        nextValues[grade.studentId] = ev.value;
      }
    }
    setWeight(foundWeight);
    setValues(nextValues);
  }

  async function handleSave() {
    if (!subjectId) return;
    const trimmedLabel = label.trim();
    const parsedWeight = Number(weight.replace(",", "."));
    if (!trimmedLabel) {
      showErrorToast("Le libellé de l'évaluation est requis.");
      return;
    }
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      showErrorToast("Le poids doit être un nombre strictement positif.");
      return;
    }
    try {
      await bulkSave.mutateAsync({
        groupeId,
        subjectId,
        trimestre,
        label: trimmedLabel,
        weight: parsedWeight,
        entries: roster.map((s) => {
          const raw = (values[s.id] ?? "").trim().replace(",", ".");
          const parsed = raw ? Number(raw) : NaN;
          return { studentId: s.id, value: raw && Number.isFinite(parsed) ? parsed : null };
        }),
      });
      showSuccessToast("Notes enregistrées.");
    } catch {
      // Erreur déjà affichée par le toast `onError` de la mutation
      // (useBulkSetGradeEvaluationMutation) — rien à faire ici.
    }
  }

  const loading = rosterQuery.isLoading || subjectsQuery.isLoading;
  const saveDisabled = isOffline || bulkSave.isPending || !subjectId || roster.length === 0;

  return (
    <View className="flex-1">
      {loading ? (
        <ActivityIndicator className="mt-4" />
      ) : (
        <View className="mb-[10px] px-4">
          <FlatList
            horizontal
            data={subjectOptions}
            keyExtractor={(item: Subject) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = item.id === subjectId;
              return (
                <Pressable
                  onPress={() => setSubjectId(item.id)}
                  className={`mr-2 rounded-2xl px-3 py-[6px] ${isSelected ? "bg-[#1d4ed8]" : "bg-[#f0f0f0]"}`}
                >
                  <Text className={`text-[13px] ${isSelected ? "font-semibold text-white" : "text-[#333]"}`}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text className="mt-4 text-center text-[#999]">Aucune matière pour cette classe.</Text>}
          />
        </View>
      )}

      {!subjectId ? (
        <Text className="mt-8 text-center text-[#999]">Choisissez une matière.</Text>
      ) : (
        <>
          {existingLabels.length > 0 && (
            <View className="mb-[10px] px-4">
              <FlatList
                horizontal
                data={existingLabels}
                keyExtractor={(l) => l}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isActive = item === label;
                  return (
                    <Pressable
                      onPress={() => selectExistingLabel(item)}
                      className={`mr-2 rounded-2xl border px-3 py-[6px] ${isActive ? "border-[#1d4ed8] bg-[#1d4ed8]" : "border-[#c7d2fe] bg-[#eef2ff]"}`}
                    >
                      <Text className={`text-xs font-semibold ${isActive ? "text-white" : "text-[#1d4ed8]"}`}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            </View>
          )}

          <View className="mb-[10px] flex-row gap-2 px-4">
            <TextInput
              className="flex-[2] rounded-lg border border-[#ddd] bg-white px-[10px] py-2 text-[13px]"
              placeholder="Libellé (ex. Devoir 1)"
              value={label}
              onChangeText={setLabel}
            />
            <TextInput
              className="flex-1 rounded-lg border border-[#ddd] bg-white px-[10px] py-2 text-[13px]"
              placeholder="Poids (ex. 25)"
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
            />
          </View>

          <FlatList
            data={roster}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 4 }}
            ListEmptyComponent={<Text className="mt-4 text-center text-[#999]">Aucun élève dans cette classe.</Text>}
            renderItem={({ item }) => (
              <StudentGradeRow
                student={item}
                value={values[item.id] ?? ""}
                onChange={(v) => setValues((prev) => ({ ...prev, [item.id]: v }))}
              />
            )}
          />

          <View className="border-t border-t-[#eee] p-4 pt-2">
            {isOffline && (
              <Text className="mb-2 text-center text-xs text-[#c0392b]">
                Vous êtes hors ligne — l'enregistrement est indisponible.
              </Text>
            )}
            <Pressable
              onPress={handleSave}
              disabled={saveDisabled}
              className={`items-center rounded-[10px] py-3 ${saveDisabled ? "bg-[#9ca3af]" : "bg-[#1d4ed8]"}`}
            >
              <Text className="text-sm font-bold text-white">
                {bulkSave.isPending ? "Enregistrement…" : "Enregistrer les notes"}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function StudentGradeRow({
  student,
  value,
  onChange,
}: {
  student: Student;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="mb-2 flex-row items-center justify-between rounded-[10px] bg-[#f5f7fa] p-[14px]">
      <View>
        <Text className="text-[15px] font-semibold">{student.fullName}</Text>
        <Text className="mt-[2px] text-xs text-[#888]">{student.matricule}</Text>
      </View>
      <TextInput
        className="w-[70px] rounded-lg border border-[#ddd] bg-white px-[10px] py-[6px] text-center text-sm"
        placeholder="—"
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
      />
    </View>
  );
}

// ----------------------------------------------------------------------------
// Vue "Classement" (itération 70, inchangée)
// ----------------------------------------------------------------------------

function GradesRanking({
  schoolId,
  groupeId,
  trimestre,
  router,
}: {
  schoolId: string;
  groupeId: string;
  trimestre: number;
  router: ReturnType<typeof useRouter>;
}) {
  const { data: ranking, isLoading: loadingRanking, isError } = useRankingQuery(schoolId, groupeId, trimestre);

  if (loadingRanking) return <ActivityIndicator className="mt-6" />;
  if (isError) return <Text className="mt-8 text-center text-[#c0392b]">Impossible de charger le classement.</Text>;

  return (
    <FlatList
      data={ranking}
      keyExtractor={(item) => item.student.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 4 }}
      ListEmptyComponent={<Text className="mt-4 text-center text-[#999]">Aucune note pour ce trimestre.</Text>}
      renderItem={({ item }: { item: RankingRow }) => (
        <Pressable
          className="mb-2 flex-row items-center justify-between rounded-[10px] bg-[#f5f7fa] p-[14px]"
          onPress={() =>
            router.push({
              pathname: "/(app)/schools/[schoolId]/bulletin/[studentId]",
              params: { schoolId, studentId: item.student.id, trimestre: String(trimestre) },
            })
          }
        >
          <View>
            <Text className="text-[15px] font-semibold">{item.student.fullName}</Text>
            <Text className="mt-[2px] text-xs text-[#888]">{item.student.matricule}</Text>
          </View>
          <View className="items-end">
            <Text className="text-base font-bold">{item.average != null ? item.average.toFixed(2) : "—"}</Text>
            <Text className="text-xs text-[#666]">{item.rank != null ? `${item.rank}e` : "—"}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}
