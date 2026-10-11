import { Router } from "express";
import * as controller from "./resources.controller";
import { requireAnySchoolRole, requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";
import { resourcesUpload } from "./resources.upload";


const router = Router({ mergeParams: true });


router.get("/", requireAnySchoolRole, controller.list);
router.get("/:resourceId", requireAnySchoolRole, controller.getOne);

router.get("/:resourceId/download", requireAnySchoolRole, controller.download);


const canManage = requireSchoolRole(
  SchoolRole.ADMIN,
  SchoolRole.GESTION_RESSOURCES,
  SchoolRole.ENSEIGNANT,
);

router.post("/video", canManage, controller.createVideo);

router.post(
  "/document",
  canManage,
  resourcesUpload.single("file"),
  controller.createDocument,
);

router.patch("/:resourceId", canManage, controller.update);
router.delete("/:resourceId", canManage, controller.remove);

export default router;
