import { Router } from "express";
import * as controller from "./attendance.controller";
import { requireAnySchoolRole, requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";

// Monté sur /schools/:schoolId/attendance
const router = Router({ mergeParams: true });

router.get("/", requireAnySchoolRole, controller.list);
router.get("/stats", requireAnySchoolRole, controller.stats);
router.get("/:attendanceId", requireAnySchoolRole, controller.getOne);

const canWrite = requireSchoolRole(
  SchoolRole.ADMIN,
  SchoolRole.GESTION_ELEVES,
  SchoolRole.ENSEIGNANT,
);
router.post("/", canWrite, controller.create);
router.post("/bulk", canWrite, controller.bulkSet);
router.patch("/:attendanceId", canWrite, controller.update);
router.delete("/:attendanceId", canWrite, controller.remove);

export default router;
