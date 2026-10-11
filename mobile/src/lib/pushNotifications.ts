import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

// Phase 3b (itération 78) — plan mobile, section 4.1. TROIS déclencheurs
// implémentés côté backend : un nouveau message de Messagerie reçu par un
// participant qui n'est pas déjà connecté au socket (voir
// backend/src/modules/messaging/messaging.service.ts::notifyOfflineParticipants),
// un élève marqué ABSENT avertissant ses parents/tuteurs déclarés depuis
// l'itération 87 (voir backend/src/modules/attendance/attendance.service.ts::
// notifyAbsenceGuardians), et, depuis l'itération 110 (même principe de
// cadrage explicitement délégué par l'utilisateur), une note saisie ou
// corrigée pour un élève avertissant ses parents/tuteurs déclarés (voir
// backend/src/modules/grades/grades.service.ts::notifyGradeGuardians).

// Affiche les notifications reçues même quand l'app est au premier plan —
// le comportement PAR DÉFAUT d'expo-notifications est de ne rien montrer
// dans ce cas. La Messagerie a déjà son propre indicateur temps réel
// (socket, voir messagingSocket.tsx) pendant qu'on est SUR l'écran de
// conversation concerné, mais une notification système reste utile si
// l'utilisateur est ailleurs dans l'app à ce moment-là.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushPlatform = "ios" | "android";

export interface PushRegistration {
  token: string;
  platform: PushPlatform;
}

// Itération 82 — navigation directe vers la conversation au tap sur une
// notification. `data` est fourni par le backend (voir
// backend/src/modules/messaging/messaging.service.ts::notifyOfflineParticipants,
// itération 78, `schoolId` ajouté à cette itération) — jamais un simple
// cast : depuis l'itération 87, un second déclencheur existe (absences, voir
// plus bas) avec une forme de `data` différente ; cette fonction doit
// renvoyer `null` plutôt que planter ou naviguer n'importe où face à une
// notification qui n'est pas la sienne.
export interface MessagingNotificationData {
  schoolId: string;
  conversationId: string;
}

export function extractMessagingNotificationData(data: unknown): MessagingNotificationData | null {
  if (!data || typeof data !== "object") return null;
  const { schoolId, conversationId, kind } = data as Record<string, unknown>;
  if (kind === "absence" || kind === "grade") return null; // voir extractAbsenceNotificationData / extractGradeNotificationData
  if (typeof schoolId === "string" && typeof conversationId === "string") {
    return { schoolId, conversationId };
  }
  return null;
}

// Itération 87 — pendant de `extractMessagingNotificationData` pour le
// déclencheur "absence" (voir backend/src/modules/attendance/
// attendance.service.ts::notifyAbsenceGuardians, `data: {schoolId,
// studentId, kind: "absence"}`). `kind` distingue explicitement les deux
// formes plutôt que de deviner à partir des champs présents : plus robuste
// si une future forme de `data` venait un jour à partager un nom de champ
// (ex. un `schoolId` commun aux deux, déjà le cas ici).
export interface AbsenceNotificationData {
  schoolId: string;
  studentId: string;
}

export function extractAbsenceNotificationData(data: unknown): AbsenceNotificationData | null {
  if (!data || typeof data !== "object") return null;
  const { schoolId, studentId, kind } = data as Record<string, unknown>;
  if (kind !== "absence") return null;
  if (typeof schoolId === "string" && typeof studentId === "string") {
    return { schoolId, studentId };
  }
  return null;
}

// Itération 110 — troisième déclencheur, pendant de `extractAbsenceNotificationData`
// pour le déclencheur "note" (voir backend/src/modules/grades/grades.service.ts::
// notifyGradeGuardians, `data: {schoolId, studentId, subjectName, kind: "grade"}`).
// Même forme que la donnée "absence" (schoolId + studentId) — distinguée
// uniquement par `kind`, pour la même raison de robustesse déjà documentée
// au-dessus. `subjectName` n'est volontairement pas extrait ici : aucun écran
// cible n'en a besoin, la navigation renvoie vers le même écran de synthèse
// élève que pour une absence (bulletin inclus).
export interface GradeNotificationData {
  schoolId: string;
  studentId: string;
}

export function extractGradeNotificationData(data: unknown): GradeNotificationData | null {
  if (!data || typeof data !== "object") return null;
  const { schoolId, studentId, kind } = data as Record<string, unknown>;
  if (kind !== "grade") return null;
  if (typeof schoolId === "string" && typeof studentId === "string") {
    return { schoolId, studentId };
  }
  return null;
}

// PIÈGE MOBILE, nouveau à cette itération : depuis le SDK 53 d'Expo, la
// réception de notifications PUSH DISTANTES (contrairement aux
// notifications locales) n'est plus prise en charge dans Expo Go, sur iOS
// comme sur Android — un "custom dev client" ou un build EAS est
// nécessaire, même limite déjà documentée pour `react-native-mmkv`
// (itération 76). Cette fonction échoue donc silencieusement (renvoie
// `null`) tant que l'app tourne dans Expo Go — comportement ATTENDU, pas un
// bug de cette itération, voir mobile/README.md pour le détail.
export async function registerForPushNotificationsAsync(): Promise<PushRegistration | null> {
  if (Platform.OS === "web") return null; // pas de push web dans ce périmètre

  try {
    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;
    if (finalStatus !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }
    // Refus explicite de l'utilisateur (ou plateforme qui ne répond jamais
    // "granted", ex. simulateur iOS) : on ne réessaie pas automatiquement
    // ici, ni n'insiste — le prochain démarrage d'app retentera de
    // lui-même (voir app/_layout.tsx), sans jamais bloquer l'app tant que
    // l'utilisateur n'a pas explicitement changé d'avis dans les réglages.
    if (finalStatus !== "granted") return null;

    // Nécessite un vrai identifiant de projet EAS (`eas init`) pour obtenir
    // un jeton exploitable par le service Expo Push — jamais configuré
    // dans ce projet jusqu'ici (aucun compte EAS réel dans cet
    // environnement de développement, voir mobile/README.md et eas.json).
    // Sans lui, `getExpoPushTokenAsync` lève une erreur — interceptée par
    // le `catch` englobant ci-dessous, traitée comme "push indisponible"
    // plutôt que comme un crash de l'app.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token, platform: Platform.OS === "ios" ? "ios" : "android" };
  } catch {
    // Best-effort — un push indisponible (Expo Go, simulateur, refus de
    // permission, absence de réseau, projectId manquant...) ne doit JAMAIS
    // empêcher le reste de l'app de fonctionner normalement.
    return null;
  }
}
