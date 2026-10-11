import { Router } from "express";
import * as controller from "./student-network.controller";
import { requireSchoolRole } from "../../middleware/auth";
import { SchoolRole } from "../../config/prisma";

// Monté sur /schools/:schoolId/student-network.
//
// Itération 46 — cadrage explicite de l'utilisateur (AskUserQuestion) :
// mêmes rôles que ceux qui gèrent déjà les élèves au sein d'une école
// (ADMIN/GESTION_ELEVES, voir students.routes.ts) — jamais `requireAnySchoolRole`
// ici, contrairement à la plupart des lectures de ce projet : cette route
// traverse la frontière entre écoles et expose, une fois un élève trouvé,
// son dossier complet (notes, présences, paiements) dans SES AUTRES écoles —
// un pouvoir bien plus large qu'une simple lecture au sein de sa propre
// école, réservé aux rôles déjà habilités à gérer les élèves.
const router = Router({ mergeParams: true });

router.get("/search", requireSchoolRole(SchoolRole.ADMIN, SchoolRole.GESTION_ELEVES), controller.search);

export default router;
