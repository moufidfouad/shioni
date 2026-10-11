import { Router } from "express";
import * as controller from "./grades.controller";
import { requireAnySchoolRole, requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";

// Monté sur /schools/:schoolId/grades
const router = Router({ mergeParams: true });

// Lecture : tout membre de l'école (un enseignant sans le rôle GESTION_NOTES
// mais rattaché à l'école, ou un ADMIN, doit pouvoir consulter bulletins et
// classements).
router.get("/", requireAnySchoolRole, controller.list);
router.get("/ranking", requireAnySchoolRole, controller.ranking);
router.get("/bulletin/:studentId", requireAnySchoolRole, controller.bulletin);
router.get("/:gradeId", requireAnySchoolRole, controller.getOne);

// Écriture : ADMIN, GESTION_NOTES (feuille "NOTES & BULLETINS", cf. tableau
// RBAC du README), ou ENSEIGNANT — depuis l'itération 29, un enseignant peut
// saisir les notes, mais UNIQUEMENT pour ses propres classes/matières (voir
// resolveTeacherScope / assertClassSubjectInScope dans grades.controller.ts
// et grades.service.ts, qui appliquent cette restriction).
const canWrite = requireSchoolRole(SchoolRole.ADMIN, SchoolRole.GESTION_NOTES, SchoolRole.ENSEIGNANT);
router.post("/", canWrite, controller.create);
// "/bulk" AVANT "/:gradeId" : Express résout la première route qui matche,
// et "/bulk" matcherait aussi le paramètre `:gradeId` si l'ordre était
// inversé (même règle que "/stats"/"/ranking" dans les autres modules).
router.post("/bulk", canWrite, controller.bulkSet);
router.delete("/bulk", canWrite, controller.deleteEvaluation);
router.patch("/:gradeId", canWrite, controller.update);
router.delete("/:gradeId", canWrite, controller.remove);

export default router;
