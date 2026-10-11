import { prisma } from "../../config/prisma";
import type { ContactMessageInput } from "./contact.schema";

// Itération 62 — demande utilisateur : "la page contact doit avoir une
// fonctionnalité réelle". Pas de service d'e-mail disponible dans ce bac à
// sable (aucun identifiant SMTP configuré, aucun accès réseau sortant vers
// un tel service) : la version réaliste ici est un enregistrement en base
// (choix confirmé par l'utilisateur via `AskUserQuestion`), qui remplace le
// simulateur côté frontend (délai + `console.info`, voir l'ancien
// commentaire de `Contact.tsx::handleSubmit`). Aucune interface de
// consultation n'est ajoutée par cette itération (l'utilisateur a choisi de
// ne pas l'inclure) — les messages restent en base, consultables plus tard
// via une requête directe ou une future page d'administration.
export async function createContactMessage(input: ContactMessageInput) {
  return prisma.contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
    },
  });
}
