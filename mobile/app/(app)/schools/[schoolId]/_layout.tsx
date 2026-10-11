import { ActivityIndicator, Text, View } from "react-native";
import { Stack, Tabs, useLocalSearchParams } from "expo-router";
import { useSchoolQuery } from "@/src/api/schools";
import { useAuthStore } from "@/src/store/authStore";

// Itération 90 — restructuration en Tabs, deuxième item de cadrage délégué
// à l'itération 87 (« je vous laisse le choix de ce cadrage »), déjà
// anticipée par le commentaire d'origine de ce fichier (Phase 1) : « un
// simple Stack pour cette Phase 1... Deviendra un Tabs (Tableau de bord /
// Notes / Présences / Messagerie) en Phase 2, une fois ces modules portés
// — voir la structure de dossiers cible dans le plan mobile, section 2.2 ».
// Exactement CES 4 onglets, ni plus ni moins — portée reprise telle que
// documentée à l'origine plutôt qu'inventée à cette itération, pour rester
// dans les clous du cadrage déjà délégué.
//
// PAS un Tabs universel : Notes/Présences (notes.tsx/attendance.tsx) sont
// des écrans PERSONNEL UNIQUEMENT (voir leur propre commentaire d'en-tête)
// — un compte Parent ou Élève n'y a jamais eu accès (aucun lien vers ces
// écrans depuis ParentDashboard/StudentDashboard, dashboard.tsx). Leur
// montrer ces onglets serait donc non seulement inutile mais actablement
// FAUX (appels réseau voués à un 403). `school.myRoles` (déjà chargé une
// fois ici, mis en cache par React Query — dashboard.tsx le recharge sans
// coût réseau supplémentaire) détermine donc la forme du navigateur
// AVANT même de savoir quel écran afficher : Tabs pour le Personnel
// (`isStaff`), Stack INCHANGÉ pour Parent/Élève (aucune régression sur ces
// deux profils, qui gardent exactement la navigation d'avant cette
// itération).
//
// Les 6 autres écrans de ce dossier (Emploi du temps, Paramètres, Élèves,
// Personnel, Bulletin, Enfants) restent atteignables EXACTEMENT comme avant
// (mêmes liens depuis le Tableau de bord, mêmes routes) — déclarés ici avec
// `href: null` pour ne jamais apparaître dans la barre d'onglets tout en
// restant naviguables via `router.push`, le patron documenté d'Expo Router
// pour un écran de détail atteint DEPUIS un onglet plutôt qu'un onglet
// lui-même (même modèle que le gabarit par défaut d'Expo Router : des
// onglets visibles + une route "modal" cachée).
//
// Icônes : emoji plutôt que `@expo/vector-icons` — AUCUNE dépendance
// supplémentaire (même choix que 📎/📷 ailleurs dans l'app mobile), ce
// projet n'utilisant aucune bibliothèque d'icônes jusqu'ici. Ce commentaire
// décrivait déjà ce choix depuis l'itération 90, mais AUCUN `tabBarIcon`
// n'avait en réalité jamais été ajouté aux `<Tabs.Screen>` ci-dessous —
// corrigé à l'itération 119 (voir note plus bas), en même temps que la
// fuite de faux onglets.
//
// Itération 119 — DEUX bugs réels, jamais visibles avant faute de
// vérification sur appareil (voir la note "Non vérifié, honnêtement"
// ci-dessous, maintenant levée), signalés par l'utilisateur via captures
// d'écran : (1) aucune icône, labels tronqués en anglais brut pour les 6
// écrans "cachés" — voir (2) ; (2) LES 6 ÉCRANS CENSÉS ÊTRE CACHÉS
// (`href: null`) apparaissaient quand même dans la barre, ET menaient à
// "Impossible de charger..." au clic. Cause de (2) : `personnel/`,
// `students/`, `bulletin/`, `children/[studentId]/` contiennent chacun
// PLUSIEURS fichiers (ou un fichier dynamique imbriqué) SANS leur propre
// `_layout.tsx` — Expo Router les expose alors comme routes distinctes
// (`personnel/[staffId]`, `bulletin/[studentId]`...) au niveau de CE Tabs
// parent, qui ne correspondent donc PLUS au nom exact ("personnel",
// "bulletin"...) déclaré ci-dessous avec `href: null` : elles fuitaient
// comme onglets visibles, sans icône ni libellé français (nom de fichier
// brut), et un appui dessus naviguait vers le gabarit de route SANS id
// réel, d'où l'échec de chargement. `messaging/` n'a jamais eu ce problème
// : il a SA PROPRE `_layout.tsx` depuis l'itération 74 (pour son socket),
// qui regroupait déjà accidentellement tout son contenu sous une seule
// route "messaging" — le même patron (`_layout.tsx` + `<Stack />`) est
// maintenant appliqué aux 4 autres dossiers concernés. Cause de (1) :
// aucun `tabBarIcon` réel n'était fourni (voir juste au-dessus) — corrigé
// avec les mêmes emoji que le reste de l'app, sur les 4 VRAIS onglets
// seulement (🏠 Accueil, 📝 Notes, ✅ Présences, 💬 Messagerie) ; les 6
// écrans cachés n'ont pas besoin d'icône puisqu'ils ne sont, désormais
// pour de vrai, jamais visibles dans la barre.
//
// **Vérifié** (voir mobile/README.md pour le détail) : la note "Non
// vérifié, honnêtement" ci-dessous, qui couvrait précisément ce rendu de
// barre d'onglets depuis l'itération 90, est donc levée par ce
// signalement réel de l'utilisateur — première confirmation sur appareil
// réel de ce fichier depuis sa création.
export default function SchoolLayout() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  const { data: school, isLoading } = useSchoolQuery(schoolId);

  // Attend la résolution de `school.myRoles` avant de choisir la forme du
  // navigateur — éviter un flash Stack→Tabs (ou l'inverse) au premier
  // rendu, même principe de garde que dashboard.tsx pour le même appel.
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // Itération 118 — un superadmin n'est jamais réellement membre d'une
  // école (`school.myRoles` vide/undefined, voir dashboard.tsx) mais doit
  // recevoir la même navigation Tabs que le Personnel, même logique que
  // `isStaff` là-bas.
  const isSuperAdmin = Boolean(useAuthStore((s) => s.user)?.isSuperAdmin);
  const isStaff = Boolean(school?.myRoles && school.myRoles.length > 0) || isSuperAdmin;

  if (!isStaff) {
    return <Stack />;
  }

  return (
    <Tabs>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Tableau de bord",
          tabBarLabel: "Accueil",
          tabBarIcon: ({ size }) => <Text style={{ fontSize: size }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: "Notes",
          tabBarIcon: ({ size }) => <Text style={{ fontSize: size }}>📝</Text>,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Présences",
          tabBarIcon: ({ size }) => <Text style={{ fontSize: size }}>✅</Text>,
        }}
      />
      <Tabs.Screen
        name="messaging"
        options={{
          title: "Messagerie",
          headerShown: false,
          tabBarIcon: ({ size }) => <Text style={{ fontSize: size }}>💬</Text>,
        }}
      />

      {/* Écrans de détail/gestion, atteints depuis le Tableau de bord — pas
          des onglets, voir le commentaire ci-dessus. */}
      <Tabs.Screen name="timetable" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="students" options={{ href: null }} />
      <Tabs.Screen name="personnel" options={{ href: null }} />
      <Tabs.Screen name="bulletin" options={{ href: null }} />
      <Tabs.Screen name="children" options={{ href: null }} />
    </Tabs>
  );
}
