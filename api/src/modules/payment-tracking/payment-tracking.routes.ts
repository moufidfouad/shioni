import { Router } from "express";
import * as controller from "./payment-tracking.controller";
import { requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";

const router = Router({ mergeParams: true });
const canRead = requireSchoolRole(
  SchoolRole.ADMIN,
  SchoolRole.GESTION_FINANCES,
);

router.get("/", canRead, controller.list);
router.get("/stats", canRead, controller.stats);

export default router;
