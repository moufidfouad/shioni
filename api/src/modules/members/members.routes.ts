import { Router } from "express";
import * as controller from "./members.controller";
import { requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";

// Monté sur /schools/:schoolId/members — authenticate() est déjà appliqué
// par le routeur parent.
const router = Router({ mergeParams: true });

// Gérer les utilisateurs & rôles d'une école : réservé aux ADMIN de cette école.
router.use(requireSchoolRole(SchoolRole.ADMIN));

router.get("/", controller.list);
router.post("/", controller.add);
router.patch("/:userId", controller.updateRoles);
router.delete("/:userId", controller.remove);
router.post("/:userId/reset-password", controller.resetPassword);
// Itération 27 — création assistée de comptes Enseignant/Parent (routes
// dédiées, distinctes de POST / ci-dessus qui suppose un compte existant).
router.post("/teacher-account", controller.createTeacherAccount);
router.post("/parent-account", controller.createParentAccount);
// Itération 31 — idem, compte Élève.
router.post("/student-account", controller.createStudentAccount);

export default router;
