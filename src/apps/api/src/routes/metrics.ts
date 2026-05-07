import type { Express } from "express";
import type { MetricsService } from "../services/metrics-service.js";
import { requireUser, type AuthenticatedRequest } from "../middleware/rbac.js";

export interface MetricsRoutesOptions {
  metricsService: MetricsService;
}

export function registerMetricsRoutes(app: Express, options: MetricsRoutesOptions) {
  const { metricsService } = options;

  /**
   * GET /metrics/performance
   * Get performance metrics
   * Required role: user
   */
  app.get("/metrics/performance", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const metrics = await metricsService.getPerformance(userId);
      res.json(metrics);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch metrics";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /metrics/risk
   * Get risk metrics
   * Required role: user
   */
  app.get("/metrics/risk", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const metrics = await metricsService.getRisk(userId);
      res.json(metrics);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch risk metrics";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /metrics/equity-curve
   * Get equity curve data
   * Required role: user
   */
  app.get("/metrics/equity-curve", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const data = await metricsService.getEquityCurve(userId);
      res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch equity curve";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /metrics/trades-analysis
   * Get trades analysis
   * Required role: user
   */
  app.get("/metrics/trades-analysis", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const analysis = await metricsService.getTradesAnalysis(20, userId);
      res.json(analysis);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch trades analysis";
      res.status(500).json({ error: message });
    }
  });
}
