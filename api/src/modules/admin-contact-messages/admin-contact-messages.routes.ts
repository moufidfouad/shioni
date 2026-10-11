import { Router } from "express";
import * as controller from "./admin-contact-messages.controller";
import { authenticate, requireSuperAdmin } from "../../middleware/auth";


const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get("/", controller.list);

export default router;
