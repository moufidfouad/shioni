import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, SALT_ROUNDS);
export const comparePassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Mot de passe temporaire généré lors d'une réinitialisation assistée par un
// ADMIN/superadmin (voir members.service.ts::resetMemberPassword) — pas
// d'envoi d'email dans ce projet (aucun service SMTP configuré, choix
// documenté : "réalités du terrain" où l'accès email n'est pas garanti),
// donc ce mot de passe est renvoyé une seule fois dans la réponse HTTP pour
// être communiqué de vive voix/SMS par la personne qui fait la
// réinitialisation, jamais journalisé ni stocké en clair. Alphabet
// volontairement sans caractères ambigus à l'oral/à l'écrit (0/O, 1/l/I)
// pour rester dictable sans erreur sur le terrain.
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateTemporaryPassword(length = 10): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length];
  }
  return result;
}
