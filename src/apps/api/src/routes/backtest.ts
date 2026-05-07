import type { Express } from "express";
import type { BacktestService } from "../services/backtest-service.js";
import { requireUser, type AuthenticatedRequest } from "../middleware/rbac.js";

export interface BacktestRoutesOptions {
  backtestService: BacktestService;
}

export function registerBacktestRoutes(app: Express, options: BacktestRoutesOptions) {
  const { backtestService } = options;

  /**
   * GET /backtest/strategies
   * List available strategies
   * Required role: user
   */
  app.get("/backtest/strategies", requireUser(), async (req, res) => {
    try {
      const strategies = await backtestService.listAvailableStrategies();
      res.json(strategies);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to list strategies";
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /backtest
   * Create a new backtest
   * Required role: user
   */
  app.post("/backtest", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const {
        symbol,
        startDate,
        endDate,
        strategy,
        parameters,
        initialCapital,
        commission,
        slippage,
        interval
      } = req.body;

      if (!symbol || !startDate || !endDate || !strategy) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const backtest = await backtestService.create({
        userId,
        symbol,
        startDate,
        endDate,
        strategy,
        parameters,
        initialCapital,
        commission,
        slippage,
        interval
      });

      res.json(backtest);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create backtest";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /backtest
   * List user's backtests
   * Required role: user
   */
  app.get("/backtest", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const backtests = await backtestService.list(userId);
      res.json(backtests);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch backtests";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /backtest/:id
   * Get backtest details
   * Required role: user
   */
  app.get("/backtest/:id", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const backtest = await backtestService.get(userId, id);
      if (!backtest) {
        return res.status(404).json({ error: "Backtest not found" });
      }

      res.json(backtest);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch backtest";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /backtest/:id/trades
   * Get backtest trades
   * Required role: user
   */
  app.get("/backtest/:id/trades", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const trades = await backtestService.getTrades(userId, id);
      res.json(trades);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch trades";
      res.status(500).json({ error: message });
    }
  });
}
