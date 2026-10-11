import { Router } from "express";
import * as controller from "./schools.controller";
import { authenticate, requireSchoolMemberOrGuardian, requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";
import { schoolLogoUpload } from "../../middleware/imageUpload";
import membersRouter from "../members/members.routes";
import parametersRouter from "../parameters/parameters.routes";
import studentsRouter from "../students/students.routes";
import subjectsRouter from "../subjects/subjects.routes";
import enrollmentsRouter from "../enrollments/enrollments.routes";
import tuitionRouter from "../tuition/tuition.routes";
import paymentTrackingRouter from "../payment-tracking/payment-tracking.routes";
import gradesRouter from "../grades/grades.routes";
import endOfYearRouter from "../end-of-year/end-of-year.routes";
import attendanceRouter from "../attendance/attendance.routes";
import personnelRouter from "../personnel/personnel.routes";
import timetableRouter from "../timetable/timetable.routes";
import financesRouter from "../finances/finance.routes";
import dashboardRouter from "../dashboard/dashboard.routes";
import analyticsRouter from "../analytics/analytics.routes";
import parentPortalRouter from "../parent-portal/parent-portal.routes";
import studentPortalRouter from "../student-portal/student-portal.routes";
import meRouter from "../me/me.routes";
import messagingRouter from "../messaging/messaging.routes";
import studentNetworkRouter from "../student-network/student-network.routes";
import resourcesRouter from "../resources/resources.routes";

const router = Router();

router.use(authenticate);

// Créer une école : tout utilisateur connecté peut en créer autant qu'il veut.
router.post("/", controller.create);

// Lister MES écoles (ou toutes si superadmin).
router.get("/", controller.list);

// Détail d'une école : accessible à tout membre du personnel, OU à un
// Parent lié à un élève de cette école (itération 27 — voir
// requireSchoolMemberOrGuardian, qui ne doit JAMAIS être réutilisé sur un
// endpoint renvoyant des données par élève).
router.get("/:schoolId", requireSchoolMemberOrGuardian, controller.getOne);

// Modifier / supprimer une école : réservé aux ADMIN de cette école.
router.patch("/:schoolId", requireSchoolRole(SchoolRole.ADMIN), controller.update);
router.delete("/:schoolId", requireSchoolRole(SchoolRole.ADMIN), controller.remove);

// Itération 64 — logo d'école. Lecture alignée sur `GET /:schoolId`
// (requireSchoolMemberOrGuardian) ; écriture réservée à l'ADMIN comme
// update/remove ci-dessus.
router.get("/:schoolId/logo", requireSchoolMemberOrGuardian, controller.getLogo);
router.post("/:schoolId/logo", requireSchoolRole(SchoolRole.ADMIN), schoolLogoUpload.single("logo"), controller.uploadLogo);
router.delete("/:schoolId/logo", requireSchoolRole(SchoolRole.ADMIN), controller.removeLogo);

// Sous-modules scopés à une école.
router.use("/:schoolId/members", membersRouter);
router.use("/:schoolId/parameters", parametersRouter);
router.use("/:schoolId/students", studentsRouter);
router.use("/:schoolId/subjects", subjectsRouter);
router.use("/:schoolId/enrollments", enrollmentsRouter);
// Itération 34 — écolage mensuel (distinct du droit d'inscription annuel
// ci-dessus) + rapport "Suivi des paiements" qui croise les deux.
router.use("/:schoolId/tuition-fees", tuitionRouter);
router.use("/:schoolId/payment-tracking", paymentTrackingRouter);
router.use("/:schoolId/grades", gradesRouter);
// Itération 43 — décisions de fin d'année (passage/redoublement/départ/
// réorientation) : s'appuie sur les moyennes du module Notes ci-dessus
// (computeClassAverages réutilisé), mais reste un module séparé (décision
// d'affectation d'élève, pas une décision de notation).
router.use("/:schoolId/end-of-year", endOfYearRouter);
router.use("/:schoolId/attendance", attendanceRouter);
router.use("/:schoolId/personnel", personnelRouter);
router.use("/:schoolId/timetable", timetableRouter);
router.use("/:schoolId/finances", financesRouter);
router.use("/:schoolId/dashboard", dashboardRouter);
// Itération 35 — tableau de bord d'analyse pédagogique (cycle/classe/série/
// groupe/salle), distinct de /dashboard (vue d'ensemble générale existante).
router.use("/:schoolId/analytics", analyticsRouter);
// Itération 29 — "moi dans cette école" (résumé de scope Enseignant).
router.use("/:schoolId/me", meRouter);
// Itération 27 — portail Parent : ce routeur applique SA PROPRE
// vérification d'accès (lien StudentGuardian par élève consulté), pas
// requireAnySchoolRole/requireSchoolRole — un Parent n'a aucun SchoolRole.
router.use("/:schoolId/parent", parentPortalRouter);
// Itération 31 — portail Élève : même principe, vérification par le
// service lui-même (Student.userId) — un Élève n'a aucun SchoolRole.
router.use("/:schoolId/student", studentPortalRouter);
// Itération 45 — messagerie instantanée : ouverte à "tout membre d'une même
// école" (personnel ET parents ET élèves, cadrage `AskUserQuestion`), donc
// son propre garde d'accès (`requireSchoolMemberOrGuardian`, posé à
// l'intérieur du routeur lui-même) plutôt que `requireAnySchoolRole`.
router.use("/:schoolId/messaging", messagingRouter);
// Itération 46 — recherche inter-écoles, voir student-network.routes.ts.
router.use("/:schoolId/student-network", studentNetworkRouter);
// Itération 48 — partage de ressources au public : volet GESTION
// (authentifié), à distinguer de /api/public/resources (public, monté dans
// app.ts, hors de ce routeur `/schools`).
router.use("/:schoolId/resources", resourcesRouter);

export default router;
