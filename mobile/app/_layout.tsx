// Itération 90 — NativeWind : feuille globale générée par Tailwind, importée
// UNE SEULE FOIS ici (racine) — voir tailwind.config.js pour le choix du
// design system. Import de CÔTÉ (pas de valeur consommée), doit rester le
// tout premier import du fichier par convention NativeWind/Metro.
import "../global.css";

import { useEffect } from "react";
import { ActivityIndicator, AppState, AppStateStatus, Platform, View } from "react-native";
import { Slot, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { focusManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";
import { PERSIST_BUSTER, PERSIST_MAX_AGE, persister, queryClient, setupOnlineManager } from "@/src/lib/queryClient";
import { useAuthStore } from "@/src/store/authStore";
import {
  extractAbsenceNotificationData,
  extractGradeNotificationData,
  extractMessagingNotificationData,
  registerForPushNotificationsAsync,
} from "@/src/lib/pushNotifications";
import { registerPushToken } from "@/src/api/pushTokens";
import { setStoredPushToken } from "@/src/lib/storage";

// Relaie l'état premier-plan/arrière-plan de l'app à TanStack Query (Phase
// 3a, itération 76) — RN n'a pas d'équivalent de l'événement navigateur
// `visibilitychange` dont la librairie se sert par défaut sur le web pour
// `refetchOnWindowFocus` ; sans ce branchement, revenir au premier plan
// après un moment ne revaliderait jamais les données potentiellement
// périmées (voir plan mobile, section 4.5). `Platform.OS !== "web"` : ne
// rien faire sous `expo start --web`, où l'événement navigateur natif existe
// déjà et gère ça tout seul.
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

// Layout racine (Expo Router) — équivalent de frontend/src/main.tsx côté
// web : monte les providers globaux UNE SEULE FOIS (PersistQueryClientProvider,
// SafeAreaProvider) puis délègue tout le reste aux groupes de routes
// (auth)/ et (app)/ via <Slot />. Le bootstrap de session (lecture
// SecureStore + validation GET /auth/me, voir authStore.ts) est déclenché
// ICI plutôt que dans un des deux groupes, pour ne s'exécuter qu'une seule
// fois par démarrage d'app, jamais à chaque navigation entre groupes.
//
// `PersistQueryClientProvider` remplace `QueryClientProvider` depuis la
// Phase 3a (itération 76, offline en lecture, voir src/lib/queryClient.ts) —
// restaure automatiquement le cache MMKV au démarrage (hydratation) puis le
// persiste au fil des requêtes réussies, sans rien changer au comportement
// des écrans qui utilisent déjà `useQuery`/`useInfiniteQuery` ailleurs dans
// l'app.
export default function RootLayout() {
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const router = useRouter();

  useEffect(() => {
    bootstrap();
    setupOnlineManager();
    const appStateSubscription = AppState.addEventListener("change", onAppStateChange);
    return () => {
      appStateSubscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 3b (itération 78) — enregistrement du jeton push UNE FOIS que le
  // statut d'auth passe à "signedIn" (jamais avant : un jeton n'a de sens
  // qu'associé à un compte, voir backend/src/modules/push-tokens). Ré-exécuté
  // à chaque transition vers "signedIn" (login, register, ET retour d'un
  // bootstrap réussi) plutôt qu'une seule fois au montage — couvre aussi le
  // cas d'un second compte connecté sur le même appareil après un logout
  // (voir authStore.ts::logout, qui désenregistre déjà l'ancien jeton).
  // Best-effort intégral : `registerForPushNotificationsAsync` ne lève
  // jamais (voir son commentaire), et l'appel réseau qui suit est ignoré en
  // cas d'échec — jamais bloquant pour le reste de l'app.
  useEffect(() => {
    if (status !== "signedIn") return;
    let cancelled = false;
    (async () => {
      const registration = await registerForPushNotificationsAsync();
      if (!registration || cancelled) return;
      try {
        await registerPushToken(registration.token, registration.platform);
        setStoredPushToken(registration.token);
      } catch {
        // Ignoré volontairement — un prochain démarrage de l'app
        // retentera de lui-même (voir registerForPushNotificationsAsync).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  // Itération 82 — navigation directe vers la conversation au tap sur une
  // notification (donnée `data.conversationId`/`data.schoolId` déjà
  // transmise depuis l'itération 78, non branchée jusqu'ici — voir
  // src/lib/pushNotifications.ts). DEUX sources couvertes, comme le
  // documente expo-notifications : `addNotificationResponseReceivedListener`
  // pour un tap alors que l'app tourne déjà (premier plan OU arrière-plan,
  // JS toujours actif), ET `getLastNotificationResponseAsync` pour le cas
  // où le tap a ENTIÈREMENT relancé l'app (cold start) — sans ce second
  // appel, un tap qui démarre l'app serait silencieusement perdu. Ne
  // navigue que si `status === "signedIn"` : sinon la garde de `(app)/
  // _layout.tsx` renverrait de toute façon vers /login, ce push serait
  // sans effet utile.
  //
  // Itération 87 — second déclencheur (absence, voir extractAbsenceNotifi-
  // cationData) branché sur le MÊME handler plutôt qu'un second listener :
  // un seul tap ne peut correspondre qu'à UNE notification, `extractMessagingNotificationData`
  // renvoie déjà `null` pour une donnée `kind: "absence"` (et vice versa),
  // donc les deux extractions sont mutuellement exclusives par construction
  // — pas de risque de double navigation. Route vers le résumé de l'enfant
  // (`children/[studentId]`, écran Parent existant depuis la Phase 2b) : le
  // seul endroit où un Parent peut voir le détail d'une présence.
  //
  // Itération 110 — troisième déclencheur (note, voir extractGradeNotifi-
  // cationData), même principe : `kind` rend les trois extractions
  // mutuellement exclusives par construction. Route vers CE MÊME écran
  // `children/[studentId]` (et non un écran Bulletin dédié) — il affiche déjà
  // le bulletin de l'enfant, exactement ce dont a besoin un parent averti
  // d'une nouvelle note.
  //
  // Correctif — `Platform.OS === "web"` : `getLastNotificationResponseAsync`
  // (et plus largement l'API de réponse aux notifications d'expo-notifications)
  // n'est pas supportée sur le web ("not available on web" au runtime,
  // constaté en ouvrant l'app dans un navigateur) — jusqu'ici seul
  // `registerForPushNotificationsAsync` (pushNotifications.ts) avait ce garde
  // ("pas de push web dans ce périmètre"), oublié ici alors que le web n'a
  // jamais été une cible pour les notifications push mobile. Effet entier
  // sauté sur web plutôt qu'un simple guard sur l'appel fautif : le listener
  // `addNotificationResponseReceivedListener` qui suit n'a pas plus de sens
  // hors mobile.
  useEffect(() => {
    if (Platform.OS === "web") return;

    function handleResponse(response: Notifications.NotificationResponse) {
      if (status !== "signedIn") return;
      const data = response.notification.request.content.data;
      const messagingTarget = extractMessagingNotificationData(data);
      if (messagingTarget) {
        router.push({
          pathname: "/(app)/schools/[schoolId]/messaging/[conversationId]",
          params: { schoolId: messagingTarget.schoolId, conversationId: messagingTarget.conversationId },
        });
        return;
      }
      const absenceTarget = extractAbsenceNotificationData(data);
      if (absenceTarget) {
        router.push({
          pathname: "/(app)/schools/[schoolId]/children/[studentId]",
          params: { schoolId: absenceTarget.schoolId, studentId: absenceTarget.studentId },
        });
        return;
      }
      const gradeTarget = extractGradeNotificationData(data);
      if (gradeTarget) {
        router.push({
          pathname: "/(app)/schools/[schoolId]/children/[studentId]",
          params: { schoolId: gradeTarget.schoolId, studentId: gradeTarget.studentId },
        });
      }
    }

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: PERSIST_MAX_AGE, buster: PERSIST_BUSTER }}
      >
        <StatusBar style="auto" />
        {status === "booting" ? (
          // Tant que le statut n'est pas connu, ni (auth)/ ni (app)/ ne
          // doivent monter : chacun redirige sur la base de `status` (voir
          // leurs _layout.tsx respectifs), un montage prématuré
          // provoquerait une redirection vers /login puis un aller-retour
          // immédiat vers /schools dès que le bootstrap se termine — un
          // flash visuel évitable.
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <Slot />
        )}
      </PersistQueryClientProvider>
      {/* Monté UNE SEULE FOIS ici, au-dessus de tout le reste — convention
          Formik/Yup/toast de l'itération 71 (voir mobile/README.md) : les
          écrans appellent showSuccessToast/showErrorToast (src/lib/toast.ts)
          sans jamais monter leur propre <Toast />, pour un rendu cohérent
          quel que soit l'écran actif (y compris pendant une navigation). */}
      <Toast />
    </SafeAreaProvider>
  );
}
