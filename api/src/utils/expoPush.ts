import { removeTokens } from "../modules/push-tokens/push-tokens.service";

// Itération 78 — plan mobile Phase 3b (section 4.1). Client HTTP minimal
// pour le service Expo Push (https://exp.host/--/api/v2/push/send) — AUCUNE
// dépendance npm supplémentaire : `fetch` est global depuis Node 18 (voir
// package.json engines), suffisant pour ce seul besoin.
//
// Best-effort par construction : un échec d'envoi (jeton expiré, service
// Expo indisponible, pas de réseau...) ne doit JAMAIS faire échouer l'action
// qui l'a déclenché — voir l'appel dans messaging.service.ts::sendMessage,
// qui n'attend JAMAIS cette fonction avant de répondre au client REST.
export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Forme commune au "ticket" (réponse immédiate de /send) et au "reçu"
// (réponse différée de /getReceipts) — mêmes champs dans les deux cas côté
// API Expo.
export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_SEND_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_RECEIPTS_ENDPOINT = "https://exp.host/--/api/v2/push/getReceipts";

// Itération 82 — délai avant d'interroger les reçus de livraison. Le
// service Expo Push fonctionne en DEUX temps : un "ticket" renvoyé
// immédiatement par /send (qui ne signale que certaines erreurs déjà
// connues côté Expo), puis un "reçu" disponible seulement APRÈS la
// tentative réelle de livraison par APNs/FCM — c'est ce second appel qui
// révèle un jeton mort suite à une désinstallation (`DeviceNotRegistered`).
// Un `setTimeout` en mémoire est un choix DÉLIBÉRÉMENT minimal, pas une
// vraie file de tâches : il ne survit pas à un redémarrage du serveur entre
// l'envoi et la vérification (un jeton mort resterait alors simplement en
// base jusqu'au prochain envoi qui le détecterait, comme avant cette
// itération) — suffisant pour purger PROGRESSIVEMENT les jetons invalides
// sans introduire de nouvelle dépendance (file de jobs, cron...) pour ce
// seul besoin. `.unref()` : ce timer ne doit jamais empêcher le process de
// s'arrêter proprement (ex. redéploiement) — cohérent avec le caractère
// best-effort de tout ce fichier.
const RECEIPT_CHECK_DELAY_MS = 30_000;

export async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  try {
    const res = await fetch(EXPO_PUSH_SEND_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const body = (await res.json()) as { data?: ExpoPushTicket[] };
    await handleTickets(messages, body.data ?? []);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[push] Échec d'envoi vers le service Expo Push (ignoré) :", err);
  }
}

// Itération 82 — suivi des reçus de livraison, jusqu'ici explicitement hors
// périmètre (voir le commentaire d'en-tête de ce fichier avant cette
// itération). Un jeton invalide, dans un cas comme dans l'autre, est purgé
// de la base (push-tokens.service.ts::removeTokens) — best-effort, jamais
// capable de faire échouer l'envoi lui-même ni de ralentir l'appelant
// (sendExpoPushNotifications ne l'attend jamais).
async function handleTickets(messages: ExpoPushMessage[], tickets: ExpoPushTicket[]): Promise<void> {
  const immediatelyInvalid: string[] = [];
  const pendingReceipts: { id: string; token: string }[] = [];

  tickets.forEach((ticket, index) => {
    const token = messages[index]?.to;
    if (!token) return;
    if (ticket.status === "error") {
      // `DeviceNotRegistered` peut être connu d'Expo dès l'envoi (ex. un
      // jeton déjà signalé invalide lors d'un envoi précédent) — pas besoin
      // d'attendre un reçu pour purger celui-là.
      if (ticket.details?.error === "DeviceNotRegistered") immediatelyInvalid.push(token);
      return;
    }
    if (ticket.status === "ok" && ticket.id) pendingReceipts.push({ id: ticket.id, token });
  });

  if (immediatelyInvalid.length > 0) {
    await removeTokens(immediatelyInvalid).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[push] Échec de purge des jetons invalides (ignoré) :", err);
    });
  }

  if (pendingReceipts.length > 0) {
    setTimeout(() => {
      checkReceipts(pendingReceipts).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[push] Échec de la vérification des reçus de livraison (ignoré) :", err);
      });
    }, RECEIPT_CHECK_DELAY_MS).unref();
  }
}

async function checkReceipts(pending: { id: string; token: string }[]): Promise<void> {
  const res = await fetch(EXPO_PUSH_RECEIPTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ids: pending.map((p) => p.id) }),
  });
  const body = (await res.json()) as { data?: Record<string, ExpoPushTicket> };
  const receipts = body.data ?? {};

  const invalidTokens = pending
    .filter((p) => receipts[p.id]?.status === "error" && receipts[p.id]?.details?.error === "DeviceNotRegistered")
    .map((p) => p.token);

  if (invalidTokens.length > 0) await removeTokens(invalidTokens);
}
