import { Router } from "express";
import * as controller from "./parameters.controller";
import { requireAnySchoolRole, requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";

// Monté sur /schools/:schoolId/parameters
const router = Router({ mergeParams: true });

// Lecture : tout membre de l'école (utile pour afficher les frais, etc.)
router.get("/", requireAnySchoolRole, controller.get);

// Écriture : réservé à l'ADMIN de l'école.
router.patch("/", requireSchoolRole(SchoolRole.ADMIN), controller.update);
router.put("/fee-levels", requireSchoolRole(SchoolRole.ADMIN), controller.setFeeLevels);
router.delete("/fee-levels/:feeLevelId", requireSchoolRole(SchoolRole.ADMIN), controller.deleteFeeLevel);

// Itération 35 — structure pédagogique (Cycle -> Classe -> Série -> Groupe)
// + Salle. Renommage assumé de l'ancien chemin `/classrooms` en `/groupes`
// (l'entité elle-même a été renommée, voir schema.prisma) : pas d'alias de
// rétrocompatibilité, cohérent avec le choix déjà fait aux itérations
// précédentes de ne jamais garder de route morte.
router.post("/cycles", requireSchoolRole(SchoolRole.ADMIN), controller.upsertCycle);
router.delete("/cycles/:cycleId", requireSchoolRole(SchoolRole.ADMIN), controller.deleteCycle);

router.post("/classes", requireSchoolRole(SchoolRole.ADMIN), controller.upsertClasse);
router.delete("/classes/:classeId", requireSchoolRole(SchoolRole.ADMIN), controller.deleteClasse);

router.post("/series", requireSchoolRole(SchoolRole.ADMIN), controller.upsertSerie);
router.delete("/series/:serieId", requireSchoolRole(SchoolRole.ADMIN), controller.deleteSerie);

router.post("/groupes", requireSchoolRole(SchoolRole.ADMIN), controller.upsertGroupe);
router.delete("/groupes/:groupeId", requireSchoolRole(SchoolRole.ADMIN), controller.deleteGroupe);

router.post("/salles", requireSchoolRole(SchoolRole.ADMIN), controller.upsertSalle);
router.delete("/salles/:salleId", requireSchoolRole(SchoolRole.ADMIN), controller.deleteSalle);

// Itération 44 — Années scolaires (même RBAC que le reste de ce module :
// lecture ouverte via GET "/" ci-dessus qui les inclut déjà, écriture ADMIN
// uniquement).
router.post("/school-years", requireSchoolRole(SchoolRole.ADMIN), controller.upsertSchoolYear);
router.delete("/school-years/:schoolYearId", requireSchoolRole(SchoolRole.ADMIN), controller.deleteSchoolYear);
router.put("/current-school-year", requireSchoolRole(SchoolRole.ADMIN), controller.setCurrentSchoolYear);

export default router;
