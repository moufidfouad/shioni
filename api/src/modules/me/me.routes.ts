import { Router } from "express";
import * as controller from "./me.controller";
import { requireAnySchoolRole } from "../../middleware/auth";

// Monté sur /schools/:schoolId/me — informations propres à l'utilisateur
// courant DANS cette école (pas une ressource de l'école elle-même).
// Lecture seule, ouverte à tout membre (ADMIN/GESTION_* compris : la réponse
// leur indique simplement `restricted: false`).
const router = Router({ mergeParams: true });

router.get("/teaching-scope", requireAnySchoolRole, controller.getMyTeachingScope);

export default router;
