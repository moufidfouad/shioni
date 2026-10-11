import { Router } from "express";
import * as controller from "./admin-stats.controller";
import { authenticate, requireSuperAdmin } from "../../middleware/auth";

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get("/", controller.getOverview);

export default router;
