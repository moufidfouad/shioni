import { Router } from "express";
import * as controller from "./enrollments.controller";
import { requireAnySchoolRole, requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";

// Monté sur /schools/:schoolId/enrollments
const router = Router({ mergeParams: true });

router.get("/", requireAnySchoolRole, controller.list);
router.get("/stats", requireAnySchoolRole, controller.stats);
router.get("/:enrollmentId", requireAnySchoolRole, controller.getOne);

const canWrite = requireSchoolRole(
  SchoolRole.ADMIN,
  SchoolRole.GESTION_FINANCES,
);
router.post("/", canWrite, controller.create);
router.patch("/:enrollmentId", canWrite, controller.update);
router.post("/:enrollmentId/payments", canWrite, controller.recordPayment);
router.delete("/:enrollmentId", canWrite, controller.remove);

export default router;
