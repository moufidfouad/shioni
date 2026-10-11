import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import authRoutes from "./modules/auth/auth.routes";
import schoolsRoutes from "./modules/schools/schools.routes";
import publicResourcesRoutes from "./modules/public-resources/publicResources.routes";
import publicTestimonialsRoutes from "./modules/public-testimonials/publicTestimonials.routes";
import contactRoutes from "./modules/contact/contact.routes";
import adminTestimonialsRoutes from "./modules/admin-testimonials/admin-testimonials.routes";
import adminContactMessagesRoutes from "./modules/admin-contact-messages/admin-contact-messages.routes";
import adminStatsRoutes from "./modules/admin-stats/admin-stats.routes";
import mobileAuthRoutes from "./modules/auth/mobile/mobile-auth.routes";
import pushTokensRoutes from "./modules/push-tokens/push-tokens.routes";
import { errorHandler } from "./middleware/errorHandler";
import { csrfProtection } from "./middleware/csrf";
import { apiRateLimit, authRateLimit, contactRateLimit } from "./middleware/rateLimit";
import { env } from "./config/env";

export function createApp() {
  const app = express();

  // Nécessaire derrière un reverse proxy (ex: nginx, load balancer) en
  // production : sans ça, Express ne fait pas confiance à l'en-tête
  // `X-Forwarded-Proto`, donc `req.secure` reste `false` (cookies `secure`
  // jamais posés, voir utils/cookies.ts) et `express-rate-limit` peut
  // regrouper toutes les requêtes derrière le proxy sous la même IP.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(compression());
  // La session passe par des cookies httpOnly (voir src/utils/cookies.ts) :
  // `credentials: true` est nécessaire pour que le navigateur les envoie/les
  // accepte sur des requêtes cross-origin, mais un cookie "credentialed" ne
  // peut jamais s'accompagner de `Access-Control-Allow-Origin: *` (rejeté par
  // tous les navigateurs) — CORS_ORIGIN doit donc toujours être une origine
  // exacte, jamais "*".
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));


  app.use("/api", apiRateLimit);
  app.use("/api", csrfProtection);

  app.use("/api/auth", authRateLimit, authRoutes);
  app.use("/api/schools", schoolsRoutes);

  app.use("/api/public/resources", publicResourcesRoutes);

  app.use("/api/public/testimonials", publicTestimonialsRoutes);

  app.use("/api/public/contact", contactRateLimit, contactRoutes);

  app.use("/api/admin/testimonials", adminTestimonialsRoutes);
  app.use("/api/admin/contact-messages", adminContactMessagesRoutes);

  app.use("/api/admin/stats", adminStatsRoutes);

  app.use("/api/v1/mobile/auth", authRateLimit, mobileAuthRoutes);

  app.use("/api/v1/mobile/push-tokens", pushTokensRoutes);

  app.use((_req, res) => res.status(404).json({ error: "Route introuvable." }));
  app.use(errorHandler);

  return app;
}
