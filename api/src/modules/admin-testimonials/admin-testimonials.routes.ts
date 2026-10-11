import { Router } from "express";
import * as controller from "./admin-testimonials.controller";
import { authenticate, requireSuperAdmin } from "../../middleware/auth";


const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get("/", controller.list);
router.post("/", controller.upsert);
router.delete("/:id", controller.remove);

export default router;
