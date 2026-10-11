import { Router } from "express";
import * as controller from "./students.controller";
import { requireAnySchoolRole, requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";
import { studentPhotoUpload } from "../../middleware/imageUpload";


const router = Router({ mergeParams: true });

const canManage = requireSchoolRole(SchoolRole.ADMIN, SchoolRole.GESTION_ELEVES);

router.get("/", requireAnySchoolRole, controller.list);
router.get("/stats", canManage, controller.stats);
router.get("/:studentId", requireAnySchoolRole, controller.getOne);
router.post("/", canManage, controller.create);
router.patch("/:studentId", canManage, controller.update);
router.delete("/:studentId", canManage, controller.remove);


router.get("/:studentId/photo", requireAnySchoolRole, controller.getPhoto);
router.post("/:studentId/photo", canManage, studentPhotoUpload.single("photo"), controller.uploadPhoto);
router.delete("/:studentId/photo", canManage, controller.removePhoto);

export default router;
