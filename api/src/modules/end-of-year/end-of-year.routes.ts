import { Router } from "express";
import * as controller from "./end-of-year.controller";
import { requireAnySchoolRole, requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";

// Monté sur /schools/:schoolId/end-of-year
const router = Router({ mergeParams: true });

// Lecture : tout membre de l'école — un ENSEIGNANT est ensuite restreint à
// ses propres classes par resolveTeacherScope (voir end-of-year.controller.ts),
// même principe que le bulletin/classement (itération 29).
router.get("/", requireAnySchoolRole, controller.list);
router.get("/overview", requireAnySchoolRole, controller.overview);
router.get("/stats", requireAnySchoolRole, controller.stats);
router.get("/:decisionId", requireAnySchoolRole, controller.getOne);

// Écriture : ADMIN ou GESTION_ELEVES SEULEMENT — décision explicite de
// l'utilisateur à l'itération 43 (jamais ENSEIGNANT, à la différence de
// Notes/Présences/Emploi du temps).
const canWrite = requireSchoolRole(SchoolRole.ADMIN, SchoolRole.GESTION_ELEVES);
// Upsert par clé métier (studentId, schoolYearId) — voir
// end-of-year.service.ts::upsertDecision. Un seul verbe POST fait office de
// create ET de correction, jamais de PATCH/:id séparé pour ce module.
router.post("/", canWrite, controller.upsert);
router.delete("/:decisionId", canWrite, controller.remove);

export default router;
