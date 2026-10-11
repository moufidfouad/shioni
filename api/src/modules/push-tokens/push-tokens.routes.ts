import { Router } from "express";
import * as controller from "./push-tokens.controller";
import { authenticate } from "../../middleware/auth";

// Itération 78 — plan mobile Phase 3b (section 4.1). Monté directement sur
// /api/v1/mobile/push-tokens (voir app.ts) — PAS sous /schools/:schoolId :
// un jeton d'appareil appartient au COMPTE, pas à une école en particulier
// (le même appareil doit recevoir des notifications pour toutes les écoles
// où l'utilisateur est membre, pas seulement la dernière consultée). Même
// raisonnement que /v1/mobile/auth : un chemin séparé, réservé au mobile,
// plutôt qu'un ajout au routeur /schools existant.
//
// `authenticate` posé ICI (pas à côté de `authRateLimit` dans app.ts, voir
// mobile-auth.routes.ts) : contrairement à /v1/mobile/auth, ces routes ne
// PRODUISENT pas l'authentification, elles la PRÉSUPPOSENT — un jeton push
// n'a de sens qu'associé à un compte déjà connecté.
const router = Router();
router.use(authenticate);

router.post("/", controller.register);
router.post("/unregister", controller.unregister);

export default router;
