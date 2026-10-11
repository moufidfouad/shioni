import { Request, Response } from "express";
import { contactMessageSchema } from "./contact.schema";
import * as contactService from "./contact.service";

export async function create(req: Request, res: Response) {
  const input = contactMessageSchema.parse(req.body);
  await contactService.createContactMessage(input);
  // Volontairement AUCUN champ de la ligne créée n'est renvoyé (ni son id) :
  // rien côté frontend n'en a besoin (le formulaire se contente de vider et
  // d'afficher une confirmation, voir Contact.tsx), et ça évite d'exposer
  // sans raison la moindre donnée de cette table à un visiteur non
  // authentifié.
  res.status(201).json({ ok: true });
}
