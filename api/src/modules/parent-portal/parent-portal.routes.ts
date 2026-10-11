import { Router } from "express";
import * as controller from "./parent-portal.controller";

// Monté sur /schools/:schoolId/parent — authenticate() est déjà appliqué par
// schools.routes.ts. Volontairement PAS de requireAnySchoolRole/
// requireSchoolRole ici : un compte Parent n'a aucun SchoolRole (voir
// schema.prisma). Chaque fonction du service vérifie elle-même le lien
// StudentGuardian pour l'élève précis demandé.
const router = Router({ mergeParams: true });

router.get("/children", controller.listChildren);
router.get("/children/:studentId/summary", controller.getChildSummary);
// Itération 72 — Phase 2b mobile (emploi du temps).
router.get("/children/:studentId/timetable", controller.getChildTimetable);

export default router;
