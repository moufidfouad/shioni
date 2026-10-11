import { Router } from "express";
import * as controller from "./student-portal.controller";

// Monté sur /schools/:schoolId/student — authenticate() est déjà appliqué
// par schools.routes.ts. Volontairement PAS de requireAnySchoolRole/
// requireSchoolRole ici : un compte Élève n'a aucun SchoolRole (voir
// schema.prisma). Le service vérifie lui-même le lien Student.userId.
const router = Router({ mergeParams: true });

router.get("/me/summary", controller.getMySummary);
// Itération 72 — Phase 2b mobile (emploi du temps).
router.get("/me/timetable", controller.getMyTimetable);

export default router;
