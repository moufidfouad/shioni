import { Router } from "express";
import * as controller from "./finance.controller";
import { requireAnySchoolRole, requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";

// Monté sur /schools/:schoolId/finances
const router = Router({ mergeParams: true });

// Lecture : tout membre de l'école (même patron qu'Inscriptions & frais —
// pas de donnée personnelle sensible ici, contrairement à Personnel).
router.get("/", requireAnySchoolRole, controller.list);
router.get("/stats", requireAnySchoolRole, controller.stats);
router.get("/monthly", requireAnySchoolRole, controller.monthly);
router.get("/:entryId", requireAnySchoolRole, controller.getOne);

// Écriture : ADMIN ou GESTION_FINANCES (feuille "FINANCES", même rôle
// qu'Inscriptions & frais).
const canWrite = requireSchoolRole(SchoolRole.ADMIN, SchoolRole.GESTION_FINANCES);
router.post("/", canWrite, controller.create);
router.patch("/:entryId", canWrite, controller.update);
router.delete("/:entryId", canWrite, controller.remove);

export default router;
