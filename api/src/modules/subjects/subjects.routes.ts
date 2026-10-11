import { Router } from "express";
import * as controller from "./subjects.controller";
import { requireAnySchoolRole, requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";

// Monté sur /schools/:schoolId/subjects
const router = Router({ mergeParams: true });

// Lecture : tout membre de l'école (les coefficients seront consultés par
// les modules Notes & Emploi du temps, pas seulement l'ADMIN).
router.get("/", requireAnySchoolRole, controller.list);
router.get("/:subjectId", requireAnySchoolRole, controller.getOne);

// Écriture : réservée à l'ADMIN de l'école (feuille "MATIERES & COEFFICIENTS").
router.post("/", requireSchoolRole(SchoolRole.ADMIN), controller.create);
router.patch("/:subjectId", requireSchoolRole(SchoolRole.ADMIN), controller.update);
router.delete("/:subjectId", requireSchoolRole(SchoolRole.ADMIN), controller.remove);
router.put("/:subjectId/coefficients", requireSchoolRole(SchoolRole.ADMIN), controller.setCoefficients);
router.delete(
  "/:subjectId/coefficients/:groupeId",
  requireSchoolRole(SchoolRole.ADMIN),
  controller.deleteCoefficient
);

export default router;
