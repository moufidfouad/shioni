import { Request, Response } from "express";
import { getMyScopeSummary } from "../../utils/teacherScope";

// Itération 29 — "filtrage fin Enseignant" : cet endpoint expose au
// frontend le résumé du scope de L'UTILISATEUR COURANT dans cette école,
// pour filtrer les sélecteurs de classe/matière d'un compte Enseignant
// restreint sans dupliquer la logique de scope côté client (voir
// useMyTeachingScopeQuery côté frontend). `restricted: false` signifie
// "aucun filtrage à appliquer" (accès complet, quel qu'en soit le rôle).
export async function getMyTeachingScope(req: Request<{ schoolId: string }>, res: Response) {
  const summary = await getMyScopeSummary(req, req.params.schoolId);
  res.json(summary);
}
