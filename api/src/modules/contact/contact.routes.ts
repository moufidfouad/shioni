import { Router } from "express";
import * as controller from "./contact.controller";

// Monté DIRECTEMENT sur /api/public/contact (voir app.ts) — même famille que
// /api/public/resources et /api/public/testimonials : AUCUN middleware
// `authenticate` ici, c'est un visiteur qui n'est justement pas connecté qui
// envoie ce message. `apiRateLimit` (global sur /api/*) s'applique, complété
// ici par `contactRateLimit` (plus strict, voir middleware/rateLimit.ts) —
// contrairement aux routes GET publiques déjà existantes, celle-ci accepte
// une écriture non authentifiée, donc un vecteur de spam si elle n'était
// couverte que par la limite générale. `csrfProtection` (posé globalement
// sur /api/* dans app.ts) s'applique aussi : POST est une méthode "unsafe"
// pour ce middleware, mais le cookie CSRF est posé dès le premier GET de
// toute page publique (voir `middleware/csrf.ts`), donc déjà présent avant
// que ce formulaire soit soumis.
const router = Router();

router.post("/", controller.create);

export default router;
