import { z } from "zod";

// Itération 78 — plan mobile Phase 3b (section 4.1). Un seul schéma
// d'entrée : `platform` est volontairement restreint à "ios"/"android" ici
// (contrairement au champ `String` libre du modèle Prisma, voir son
// commentaire) — c'est la couche de VALIDATION qui documente les seules
// valeurs que le mobile envoie réellement aujourd'hui, le stockage restant
// délibérément permissif pour ne pas avoir à migrer le schéma si une
// troisième plateforme (web push ?) apparaissait un jour.
export const registerPushTokenSchema = z.object({
  token: z.string().min(1, "Jeton push requis."),
  platform: z.enum(["ios", "android"]),
});

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;

export const unregisterPushTokenSchema = z.object({
  token: z.string().min(1, "Jeton push requis."),
});

export type UnregisterPushTokenInput = z.infer<typeof unregisterPushTokenSchema>;
