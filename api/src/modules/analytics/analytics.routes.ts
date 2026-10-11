import { Router } from "express";
import * as controller from "./analytics.controller";
import { requireAnySchoolRole } from "../../middleware/auth";

const router = Router({ mergeParams: true });

router.get("/", requireAnySchoolRole, controller.getOverview);

export default router;
