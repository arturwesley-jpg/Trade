import type { Express } from "express";
import { registerAuthRoutes, type AuthRoutesOptions } from "./auth.js";
import { registerMarketRoutes, type MarketRoutesOptions } from "./market.js";

export interface RouteOptions {
  auth: AuthRoutesOptions;
  market: MarketRoutesOptions;
}

export function registerAllRoutes(app: Express, options: RouteOptions) {
  registerAuthRoutes(app, options.auth);
  registerMarketRoutes(app, options.market);
}

export { registerAuthRoutes, registerMarketRoutes };
export { requireRole, requireAdmin, requireUser } from "../middleware/rbac.js";
