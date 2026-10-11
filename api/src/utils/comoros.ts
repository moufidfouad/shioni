import { z } from "zod";


export const DEFAULT_CURRENCY = "KMF";


export const COMOROS_ISLANDS = ["Ngazidja", "Anjouan", "Mohéli"] as const;
export type ComorosIsland = (typeof COMOROS_ISLANDS)[number];
export const islandSchema = z.enum(COMOROS_ISLANDS);


const COMOROS_PHONE_REGEX = /^(?:\+269|00269)?[\s-]?[3-7]\d{2}[\s-]?\d{2}[\s-]?\d{2}$/;

export const comorosPhoneSchema = z
  .string()
  .trim()
  .regex(
    COMOROS_PHONE_REGEX,
    "Numéro comorien invalide (attendu : 7 chiffres commençant par 3, 4 ou 7, avec ou sans indicatif +269)."
  );

// Version "optionnelle avec message" — le champ reste facultatif (comme
// avant), mais s'il est renseigné il doit respecter le format ci-dessus.
// `z.literal("")` autorise explicitement une chaîne vide (formulaire vidé
// par l'utilisateur) sans déclencher l'erreur de regex.
export const optionalComorosPhoneSchema = z
  .union([comorosPhoneSchema, z.literal("")])
  .optional();
