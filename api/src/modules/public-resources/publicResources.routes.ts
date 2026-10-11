import { Router } from "express";
import * as controller from "./publicResources.controller";

// Monté DIRECTEMENT sur /api/public/resources (voir app.ts) — PAS sous
// /api/schools/:schoolId/..., puisque cette page est volontairement
// transversale à toutes les écoles (cadrage utilisateur : "une page publique
// ... où toutes les ressources des différentes écoles sont publiées").
//
// AUCUN middleware `authenticate`/`requireSchoolRole` ici : c'est la toute
// première surface réellement publique (sans cookie de session) de tout le
// projet — voir le commentaire d'en-tête du modèle `Resource` dans
// schema.prisma. `apiRateLimit` (posé globalement sur /api/* dans app.ts)
// s'applique néanmoins, et `csrfProtection` n'a rien à vérifier ici : toutes
// les routes de ce routeur sont des GET, exemptés par construction (voir
// middleware/csrf.ts::UNSAFE_METHODS).
const router = Router();

router.get("/", controller.list);
router.get("/filters", controller.filters);
router.get("/:resourceId", controller.getOne);
router.get("/:resourceId/download", controller.download);

export default router;
