import { Router } from "express";
import * as controller from "./tuition.controller";
import { requireAnySchoolRole, requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";

// Monté sur /schools/:schoolId/tuition-fees — même RBAC que /enrollments
// (feuille "INSCRIPTIONS & FRAIS" au sens large : droit d'inscription ET
// écolage sont tous deux des frais scolaires dus par un élève).
const router = Router({ mergeParams: true });

router.get("/", requireAnySchoolRole, controller.list);
router.get("/stats", requireAnySchoolRole, controller.stats);
router.get("/:tuitionFeeId", requireAnySchoolRole, controller.getOne);

const canWrite = requireSchoolRole(SchoolRole.ADMIN, SchoolRole.GESTION_FINANCES);
router.post("/", canWrite, controller.create);
router.post("/generate", canWrite, controller.generate);
router.patch("/:tuitionFeeId", canWrite, controller.update);
router.post("/:tuitionFeeId/payments", canWrite, controller.recordPayment);
router.delete("/:tuitionFeeId", canWrite, controller.remove);

export default router;
