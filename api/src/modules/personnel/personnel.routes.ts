import { Router } from "express";
import * as controller from "./personnel.controller";
import { requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";
import { staffPhotoUpload } from "../../middleware/imageUpload";

const router = Router({ mergeParams: true });

router.use(requireSchoolRole(SchoolRole.ADMIN));

router.get("/", controller.list);
router.get("/stats", controller.stats);
router.get("/:staffId", controller.getOne);
router.post("/", controller.create);
router.patch("/:staffId", controller.update);
router.delete("/:staffId", controller.remove);


router.get("/:staffId/photo", controller.getPhoto);
router.post(
  "/:staffId/photo",
  staffPhotoUpload.single("photo"),
  controller.uploadPhoto,
);
router.delete("/:staffId/photo", controller.removePhoto);

export default router;
