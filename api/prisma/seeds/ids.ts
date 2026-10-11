import { createHash } from "node:crypto";

// Espace de noms fixe pour ce projet (UUID v4 tiré une fois pour toutes,
// jamais régénéré). Sert de graine à `seedId()` ci-dessous.
const NAMESPACE = "6f2f6d4e-6b8a-4b8e-9c1a-2f6b0e6a8f3d";

// Dérive un UUID *déterministe* (algorithme UUID v5 standard, RFC 4122 —
// SHA-1(namespace + name), puis version/variant forcés sur le résultat) à
// partir d'une clé métier lisible ("staff:said-abdou",
// "enrollment:EL-0001:2024-2025", ...). Même clé => toujours le même id.
//
// Pourquoi : plusieurs modèles de ce schéma n'ont volontairement AUCUNE
// contrainte d'unicité en base (`StaffMember`, `Enrollment`, `Grade`,
// `AttendanceRecord`, `TimetableEntry`, `FinanceEntry` — l'unicité, quand
// elle existe, est vérifiée côté service applicatif, voir
// `enrollments.service.ts`/`grades.service.ts` : ce choix évite une
// migration Prisma dans un environnement où `prisma generate`/`migrate` est
// bloqué, voir le doc de projet). Un `prisma.model.create(...)` classique
// dans un seed dupliquerait donc ces lignes à chaque exécution. En dérivant
// un id stable de la clé naturelle de chaque ligne et en faisant un
// `upsert({ where: { id } })` dessus (`id` est TOUJOURS une clé unique,
// même sans contrainte métier dédiée), le seed devient idempotent pour ces
// modèles sans toucher au schéma.
export function seedId(key: string): string {
  const hash = createHash("sha1")
    .update(Buffer.from(NAMESPACE.replace(/-/g, ""), "hex"))
    .update(key, "utf8")
    .digest();

  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant RFC 4122

  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
