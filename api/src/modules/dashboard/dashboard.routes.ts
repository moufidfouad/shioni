import { Router } from "express";
import * as controller from "./dashboard.controller";
import { requireAnySchoolRole } from "../../middleware/auth";

// Monté sur /schools/:schoolId/dashboard — lecture seule, ouverte à tout
// membre de l'école (feuille "TABLEAU DE BORD" : "tous (lecture)" dans le
// tableau RBAC du README, aucune écriture n'existe sur cette agrégation).
const router = Router({ mergeParams: true });

router.get("/", requireAnySchoolRole, controller.getOne);

export default router;
