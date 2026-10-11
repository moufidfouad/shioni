import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSchoolQuery } from "@/src/api/schools";
import { useAuthStore } from "@/src/store/authStore";
import { useDashboardQuery } from "@/src/api/dashboard";
import { useMyChildrenQuery } from "@/src/api/parentPortal";
import { useMySummaryQuery } from "@/src/api/studentPortal";
import { StatTile } from "@/src/components/StatTile";
import { BulletinView } from "@/src/components/BulletinView";
import { TrimestrePicker } from "@/src/components/TrimestrePicker";
import { AttendanceList } from "@/src/components/AttendanceList";
import { GuardianChild } from "@/src/types";

// Écran "Tableau de bord" — Phase 2a du plan mobile. Contrairement au web,
// où le Tableau de bord (personnel) et le portail Parent/Élève sont deux
// PAGES distinctes servies par des routes web différentes selon le compte
// connecté (voir SchoolLayout.tsx côté web), ce fichier mobile fait le
// même aiguillage LUI-MÊME, sur la base de `school.myRoles`/`isGuardian`/
// `isStudent` (renvoyés par GET /schools, voir schools.service.ts) : un
// seul écran Expo Router, trois rendus possibles. Évite de dupliquer trois
// fichiers de route pour un aiguillage qui ne dépend que de données déjà en
// main, pas de la navigation elle-même.
//
// Itération 104 — QUATORZIÈME écran migré vers NativeWind : `StyleSheet.
// create` → `className`. Fichier le plus référencé par Maestro rencontré
// dans cette série de migrations (tabs-navigation.yaml, attendance-entry.
// yaml, students-browse.yaml, messaging-attachment.yaml, school-settings.
// yaml, grades-entry.yaml) — tous relus avant de commencer : chacun
// assert/tape sur un LIBELLÉ exact ("Voir les présences →", etc.), jamais
// affecté par un changement de style seul. Aucun patron de classe
// conditionnelle ici (les gardes `isAdmin &&` déterminent si un élément est
// rendu, pas son style) — migration plus directe que les itérations 95/96/
// 99/100/103 malgré la taille du fichier.
export default function SchoolDashboardScreen() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  const { data: school, isLoading, isError } = useSchoolQuery(schoolId);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  if (isError || !school) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-center text-[#c0392b]">Impossible de charger cette école.</Text>
      </View>
    );
  }

  const isSuperAdmin = Boolean(useAuthStore((s) => s.user)?.isSuperAdmin);
  const isStaff = Boolean(school.myRoles && school.myRoles.length > 0) || isSuperAdmin;

  return (
    <>
      <Stack.Screen options={{ title: school.name }} />
      {isStaff ? (
        <StaffDashboard
          schoolId={schoolId}
          isAdmin={Boolean(school.myRoles?.includes("ADMIN")) || isSuperAdmin}
        />
      ) : school.isGuardian ? (
        <ParentDashboard schoolId={schoolId} />
      ) : school.isStudent ? (
        <StudentDashboard schoolId={schoolId} />
      ) : (
        // Cas normalement inatteignable pour un compte NON-superadmin (GET
        // /schools ne renvoie que des écoles où l'utilisateur a l'un de ces
        // trois statuts, voir schools.service.ts::listSchoolsForUser) —
        // gardé par prudence plutôt qu'un écran blanc silencieux. Un
        // superadmin, lui, N'EST délibérément jamais membre d'une école
        // (voir getSchoolById) mais reçoit TOUTES les écoles via GET
        // /schools : c'était donc en réalité son chemin normal qui tombait
        // ici avant `isSuperAdmin` ci-dessus (itération 118, signalé par
        // l'utilisateur : "le superadmin quand il accède à une école dans
        // app mobile, c'est toujours 'Aucun accès reconnu pour cette
        // école'") — voir RoleGate.tsx/SchoolLayout.tsx côté web, qui
        // traitaient déjà ce cas correctement (isSuperAdmin toujours ===
        // accès Personnel complet, jamais dépendant de myRoles).
        <View className="flex-1 items-center justify-center">
          <Text className="text-center text-[#c0392b]">Aucun accès reconnu pour cette école.</Text>
        </View>
      )}
    </>
  );
}

// --- Personnel --------------------------------------------------------------

function StaffDashboard({ schoolId, isAdmin }: { schoolId: string; isAdmin: boolean }) {
  const router = useRouter();
  const { data, isLoading, isError, refetch, isRefetching } = useDashboardQuery(schoolId);

  if (isLoading) return <ActivityIndicator className="mt-10" />;
  if (isError || !data) return <Text className="text-center text-[#c0392b]">Impossible de charger le tableau de bord.</Text>;

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16 }}>
      {data.schoolYearLabel && <Text className="mb-3 text-[#666]">Année scolaire {data.schoolYearLabel}</Text>}

      <Pressable
        className="mb-4 rounded-lg bg-[#eef2ff] p-3"
        onPress={() => router.push({ pathname: "/(app)/schools/[schoolId]/notes", params: { schoolId } })}
      >
        <Text className="font-semibold text-[#1d4ed8]">Voir les notes et classements →</Text>
      </Pressable>
      <Pressable
        className="mb-4 rounded-lg bg-[#eef2ff] p-3"
        onPress={() => router.push({ pathname: "/(app)/schools/[schoolId]/attendance", params: { schoolId } })}
      >
        <Text className="font-semibold text-[#1d4ed8]">Voir les présences →</Text>
      </Pressable>
      <Pressable
        className="mb-4 rounded-lg bg-[#eef2ff] p-3"
        onPress={() => router.push({ pathname: "/(app)/schools/[schoolId]/timetable", params: { schoolId } })}
      >
        <Text className="font-semibold text-[#1d4ed8]">Voir l'emploi du temps →</Text>
      </Pressable>
      <Pressable
        className="mb-4 rounded-lg bg-[#eef2ff] p-3"
        onPress={() => router.push({ pathname: "/(app)/schools/[schoolId]/messaging", params: { schoolId } })}
      >
        <Text className="font-semibold text-[#1d4ed8]">Messagerie →</Text>
      </Pressable>
      <Pressable
        className="mb-4 rounded-lg bg-[#eef2ff] p-3"
        onPress={() => router.push({ pathname: "/(app)/schools/[schoolId]/students", params: { schoolId } })}
      >
        <Text className="font-semibold text-[#1d4ed8]">Voir les élèves →</Text>
      </Pressable>
      {/* Itération 75 — Personnel : lien affiché SEULEMENT pour un compte
          ADMIN (personnel.routes.ts est ADMIN-only dans les deux sens, lecture
          comprise — voir src/api/personnel.ts). Pour ENSEIGNANT/GESTION_*,
          l'appel échouerait de toute façon en 403 ; ne pas proposer un lien
          voué à échouer, même principe que School.isGuardian/isStudent plus
          haut dans ce fichier. */}
      {isAdmin && (
        <Pressable
          className="mb-4 rounded-lg bg-[#eef2ff] p-3"
          onPress={() => router.push({ pathname: "/(app)/schools/[schoolId]/personnel", params: { schoolId } })}
        >
          <Text className="font-semibold text-[#1d4ed8]">Voir le personnel →</Text>
        </Pressable>
      )}
      {/* Itération 89 — Paramètres de l'école (logo), même garde ADMIN-only
          que le lien Personnel juste au-dessus (POST/DELETE .../logo sont
          ADMIN-only côté backend, voir settings.tsx). */}
      {isAdmin && (
        <Pressable
          className="mb-4 rounded-lg bg-[#eef2ff] p-3"
          onPress={() => router.push({ pathname: "/(app)/schools/[schoolId]/settings", params: { schoolId } })}
        >
          <Text className="font-semibold text-[#1d4ed8]">Paramètres de l'école →</Text>
        </Pressable>
      )}

      <View className="flex-row flex-wrap justify-between">
        <StatTile label="Élèves" value={data.students.total} sub={`${data.classCount} classes`} />
        <StatTile label="Personnel" value={data.staff.total} sub={`${data.staff.actifs} actifs`} />
        <StatTile
          label="Présence"
          value={data.attendance.tauxPresence != null ? `${data.attendance.tauxPresence.toFixed(0)} %` : "—"}
        />
        <StatTile label="Emploi du temps" value={data.timetable.totalEntries} sub="créneaux" />
        <StatTile
          label="Frais dus"
          value={`${data.enrollments.totalRemaining.toLocaleString("fr-FR")}`}
          sub={`${data.enrollments.impaye} impayés`}
        />
        <StatTile
          label="Solde finances"
          value={data.finance.solde.toLocaleString("fr-FR")}
          sub={`année ${data.finance.year}`}
        />
      </View>

      <Pressable onPress={() => refetch()} className="mt-2 items-center p-3" disabled={isRefetching}>
        <Text className="text-[#1d4ed8]">{isRefetching ? "Actualisation..." : "Actualiser"}</Text>
      </Pressable>
    </ScrollView>
  );
}

// --- Parent -------------------------------------------------------------

function ParentDashboard({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const { data: children, isLoading, isError } = useMyChildrenQuery(schoolId);

  if (isLoading) return <ActivityIndicator className="mt-10" />;
  if (isError) return <Text className="text-center text-[#c0392b]">Impossible de charger vos enfants.</Text>;

  function renderItem({ item }: { item: GuardianChild }) {
    return (
      <Pressable
        className="mb-[10px] rounded-[10px] bg-[#f5f7fa] p-4"
        onPress={() =>
          router.push({
            pathname: "/(app)/schools/[schoolId]/children/[studentId]",
            params: { schoolId, studentId: item.id },
          })
        }
      >
        <Text className="text-base font-semibold">{item.fullName}</Text>
        {/* Itération 113 — `groupeLabel` (composé côté serveur, ex "6ème A")
            remplace le `groupe.name` brut affiché ici jusque-là. */}
        {(item.groupeLabel ?? item.groupe?.name) && (
          <Text className="mt-[2px] text-[13px] text-[#666]">{item.groupeLabel ?? item.groupe?.name}</Text>
        )}
      </Pressable>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 16 }}
      data={children}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={
        <>
          <Pressable
            className="mb-4 rounded-lg bg-[#eef2ff] p-3"
            onPress={() => router.push({ pathname: "/(app)/schools/[schoolId]/messaging", params: { schoolId } })}
          >
            <Text className="font-semibold text-[#1d4ed8]">Messagerie →</Text>
          </Pressable>
          <Text className="mb-3 text-base font-semibold">Mes enfants</Text>
        </>
      }
      ListEmptyComponent={<Text className="mt-10 text-center text-[#999]">Aucun enfant lié à votre compte.</Text>}
    />
  );
}

// --- Élève ----------------------------------------------------------------

function StudentDashboard({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [trimestre, setTrimestre] = useState(1);
  const { data: summary, isLoading, isError } = useMySummaryQuery(schoolId, trimestre);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 16 }}>
      <Pressable
        className="mb-4 rounded-lg bg-[#eef2ff] p-3"
        onPress={() => router.push({ pathname: "/(app)/schools/[schoolId]/timetable", params: { schoolId } })}
      >
        <Text className="font-semibold text-[#1d4ed8]">Voir mon emploi du temps →</Text>
      </Pressable>
      <Pressable
        className="mb-4 rounded-lg bg-[#eef2ff] p-3"
        onPress={() => router.push({ pathname: "/(app)/schools/[schoolId]/messaging", params: { schoolId } })}
      >
        <Text className="font-semibold text-[#1d4ed8]">Messagerie →</Text>
      </Pressable>

      {/* nbTrimestres réel non disponible pour un compte Élève : GET
          /parameters exige requireAnySchoolRole côté backend (un Élève n'a
          aucun SchoolRole, voir parameters.routes.ts) — 3 trimestres fixes,
          la borne validée partout ailleurs dans l'application (voir
          student-portal.controller.ts::parseTrimestre). Même choix que le
          web aurait dû faire : ParentPortalPage.tsx appelle ce endpoint
          malgré tout et retombe silencieusement sur `?? 3` en cas d'échec —
          ici on évite l'appel réseau voué à échouer. */}
      <Text className="mb-3 text-base font-semibold">Bulletin</Text>
      <TrimestrePicker value={trimestre} count={3} onChange={setTrimestre} />

      {isLoading ? (
        <ActivityIndicator />
      ) : isError || !summary ? (
        <Text className="text-center text-[#c0392b]">Impossible de charger votre bulletin.</Text>
      ) : (
        <>
          <BulletinView bulletin={summary.bulletin} />

          {/* Itération 72 (Phase 2b) : historique COMPLET des présences,
              déjà chargé par ce même appel (summary.attendance) — aucun
              appel réseau supplémentaire, même principe que
              children/[studentId]/index.tsx côté Parent. */}
          <Text className="mb-3 text-base font-semibold">Présences</Text>
          <AttendanceList records={summary.attendance} />
        </>
      )}
    </ScrollView>
  );
}
