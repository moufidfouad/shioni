import { Router } from "express";
import * as controller from "./timetable.controller";
import { requireAnySchoolRole, requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";

// Monté sur /schools/:schoolId/timetable
const router = Router({ mergeParams: true });

// Lecture : tout membre de l'école (même patron que Matières & coefficients,
// itération 7 — un enseignant sans rôle particulier doit pouvoir consulter
// l'emploi du temps).
router.get("/", requireAnySchoolRole, controller.list);
router.get("/:entryId", requireAnySchoolRole, controller.getOne);

// Écriture : ADMIN (feuille "EMPLOI DU TEMPS" — pas de rôle
// GESTION_EMPLOI_DU_TEMPS dédié dans le schéma RBAC actuel, même choix que
// Matières & coefficients), ou ENSEIGNANT depuis l'itération 29 — restreint
// à ses propres créneaux/classes (voir resolveTeacherScope /
// assertOwnTimetableEntry dans timetable.service.ts).
const canWrite = requireSchoolRole(SchoolRole.ADMIN, SchoolRole.ENSEIGNANT);
router.post("/", canWrite, controller.create);
router.patch("/:entryId", canWrite, controller.update);
router.delete("/:entryId", canWrite, controller.remove);

export default router;
