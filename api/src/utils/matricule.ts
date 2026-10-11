import { prisma } from "../config/prisma";

// Génère le prochain matricule séquentiel d'une école, format "EL-0001".
// La séquence est propre à chaque école (deux écoles peuvent toutes les
// deux avoir un élève "EL-0001").
//
// Correctif audit — l'ancienne implémentation dérivait le "prochain numéro"
// en triant les matricules existants par ordre alphabétique décroissant
// (`orderBy: { matricule: "desc" }, take: 1`) puis en extrayant le suffixe
// numérique par regex. Deux défauts :
//   1. Course critique : deux requêtes concurrentes lisent le même "dernier
//      matricule", calculent le même "prochain numéro" en JS, et créent
//      chacune un élève avec ce numéro — collision (bloquée in extremis par
//      @@unique([schoolId, matricule]), au prix d'une erreur visible par
//      l'utilisateur, ou pire si cette contrainte venait à manquer).
//   2. Tri lexicographique bogué : "EL-9" est ALPHABÉTIQUEMENT après
//      "EL-10" (le caractère "9" > "1"), donc `orderBy: "desc"` pouvait
//      renvoyer "EL-9" comme "dernier" alors que "EL-10" existe déjà,
//      recalculant un numéro déjà attribué (donc réutilisé, pas juste en
//      conflit passager).
//
// Nouvelle implémentation : un compteur dédié par école (`SchoolCounter`),
// incrémenté par un UPDATE atomique côté Postgres (verrou de ligne le temps
// de la requête). Deux requêtes concurrentes sur la même école ne peuvent
// plus obtenir le même numéro — Postgres sérialise les deux UPDATE sur la
// même ligne — et le calcul ne dépend plus jamais d'un tri de chaînes.
export async function generateNextMatricule(schoolId: string): Promise<string> {
  const nextNumber = await nextCounterValue(schoolId, "student_matricule");
  return `EL-${String(nextNumber).padStart(4, "0")}`;
}

// Incrémente (ou amorce) le compteur `name` d'une école et renvoie sa
// nouvelle valeur — c'est aussi le numéro à utiliser pour ce matricule.
async function nextCounterValue(schoolId: string, name: string): Promise<number> {
  // Cas normal : le compteur existe déjà pour cette école. Un simple
  // `update` avec `increment` sur la ligne existante est atomique côté
  // Postgres (l'UPDATE prend un verrou de ligne le temps de lire-modifier-
  // écrire `value`) : deux requêtes concurrentes ne peuvent pas lire puis
  // écrire la même valeur, contrairement à l'ancien schéma
  // "findMany + calcul JS + create".
  const existing = await prisma.schoolCounter.findUnique({
    where: { schoolId_name: { schoolId, name } },
  });

  if (existing) {
    const updated = await prisma.schoolCounter.update({
      where: { schoolId_name: { schoolId, name } },
      data: { value: { increment: 1 } },
    });
    return updated.value;
  }

  // Cas d'amorçage ("bootstrap") : le compteur n'existe pas encore pour
  // cette école (première génération de matricule après le déploiement de
  // ce correctif, ou école dont les élèves existants ont été créés/importés
  // avant que `SchoolCounter` n'existe). On ne peut PAS partir de 0/1 sans
  // vérifier — si cette école a déjà des élèves "EL-0001".."EL-0037", il
  // faut démarrer le compteur à 38, sinon on recrée des matricules déjà
  // attribués et on viole @@unique([schoolId, matricule]).
  //
  // Cette lecture ponctuelle réutilise l'ancienne logique (regex sur le
  // suffixe numérique), mais SEULEMENT pour ce calcul unique de démarrage —
  // elle ne sert plus jamais après la création de la ligne `SchoolCounter`
  // pour cette école, donc son bug de tri lexicographique est inoffensif
  // ici : on ne fait confiance à AUCUN ordre de tri, on lit TOUS les
  // matricules de l'école et on calcule le MAX numérique réel nous-mêmes.
  const bootstrapValue = await computeBootstrapValue(schoolId);

  try {
    const created = await prisma.schoolCounter.create({
      data: { schoolId, name, value: bootstrapValue },
    });
    return created.value;
  } catch {
    // Course sur l'amorçage lui-même : une autre requête concurrente a créé
    // le compteur entre notre `findUnique` et notre `create` (violation de
    // @@unique([schoolId, name])). Cela ne peut arriver qu'UNE SEULE fois
    // par école (la toute première génération après ce correctif) ; on
    // retombe simplement sur le chemin normal, qui trouvera désormais la
    // ligne créée par l'autre requête et l'incrémentera atomiquement.
    const updated = await prisma.schoolCounter.update({
      where: { schoolId_name: { schoolId, name } },
      data: { value: { increment: 1 } },
    });
    return updated.value;
  }
}

// Calcule, pour une école donnée, le plus grand numéro de matricule déjà
// attribué (0 si aucun élève). Ne sert qu'à l'amorçage ponctuel du compteur
// ci-dessus — voir le commentaire dans `nextCounterValue`.
async function computeBootstrapValue(schoolId: string): Promise<number> {
  const students = await prisma.student.findMany({
    where: { schoolId },
    select: { matricule: true },
  });

  let max = 0;
  for (const s of students) {
    const match = s.matricule.match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }

  return max + 1;
}
