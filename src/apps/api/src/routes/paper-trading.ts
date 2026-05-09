/**
 * Paper Trading API Routes
 * REST endpoints for paper trading with automated TP/SL execution
 */

import type { Request, Response, NextFunction } from "express";
import { requireUser, type AuthenticatedRequest } from "../middleware/rbac.js";
import type { PaperTradingService } from "@trade/trading-core";

export interface PaperTradingRoutesOptions {
  paperTradingService: PaperTradingService;
}

export function registerPaperTradingRoutes(app: any, options: PaperTradingRoutesOptions) {
  const { paperTradingService } = options;

  /**
   * POST /api/paper-trading/positions
   * Open a new paper trading position
   * Required role: user
   */
  app.post("/api/paper-trading/positions", requireUser(), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;

      const {
        symbol,
        side,
        entryPrice,
        quantity,
        leverage,
        marginUsdt,
        takeProfit,
        stopLoss,
        trailingStop
      } = req.body;

      // Validation
      if (!symbol || !side || !entryPrice || !quantity || !marginUsdt) {
        return res.status(400).json({
          error: "Missing required fields: symbol, side, entryPrice, quantity, marginUsdt"
        });
      }

      if (!['long', 'short'].includes(side)) {
        return res.status(400).json({ error: "Side must be 'long' or 'short'" });
      }

      if (entryPrice <= 0 || quantity <= 0 || marginUsdt <= 0) {
        return res.status(400).json({ error: "Price, quantity, and margin must be positive" });
      }

      const position = paperTradingService.openPosition({
        userId,
        symbol,
        side,
        entryPrice,
        quantity,
        leverage: leverage || 1,
        marginUsdt,
        takeProfit,
        stopLoss,
        trailingStop
      });

      res.status(201).json(position);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open position";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/paper-trading/positions
   * List user's paper trading positions
   * Query params: status (OPEN|CLOSED)
   * Required role: user
   */
  app.get("/api/paper-trading/positions", requireUser(), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const status = req.query.status as 'OPEN' | 'CLOSED' | undefined;

      const positions = paperTradingService.getUserPositions(userId, status);
      res.json(positions);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch positions";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/paper-trading/positions/:id
   * Get a specific position
   * Required role: user
   */
  app.get("/api/paper-trading/positions/:id", requireUser(), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const positionId = req.params.id as string;

      const position = paperTradingService.getPosition(positionId);

      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }

      if (position.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(position);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch position";
      res.status(500).json({ error: message });
    }
  });

  /**
   * PUT /api/paper-trading/positions/:id
   * Update position TP/SL
   * Required role: user
   */
  app.put("/api/paper-trading/positions/:id", requireUser(), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const positionId = req.params.id as string;

      const position = paperTradingService.getPosition(positionId);

      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }

      if (position.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { takeProfit, stopLoss, trailingStop } = req.body;

      const updatedPosition = paperTradingService.updatePosition(positionId, {
        takeProfit,
        stopLoss,
        trailingStop
      });

      res.json(updatedPosition);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update position";
      res.status(500).json({ error: message });
    }
  });

  /**
   * DELETE /api/paper-trading/positions/:id
   * Close a position manually
   * Required role: user
   */
  app.delete("/api/paper-trading/positions/:id", requireUser(), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const positionId = req.params.id as string;
      const { exitPrice } = req.body;

      const position = paperTradingService.getPosition(positionId);

      if (!position) {
        return res.status(404).json({ error: "Position not found" });
      }

      if (position.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!exitPrice || exitPrice <= 0) {
        return res.status(400).json({ error: "Valid exitPrice is required" });
      }

      const trade = paperTradingService.closePosition(positionId, {
        exitPrice,
        reason: 'MANUAL'
      });

      res.json(trade);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to close position";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/paper-trading/history
   * Get user's trade history
   * Query params: limit (number)
   * Required role: user
   */
  app.get("/api/paper-trading/history", requireUser(), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      const history = paperTradingService.getUserTradeHistory(userId, limit);
      res.json(history);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch trade history";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/paper-trading/performance
   * Get user's performance metrics
   * Required role: user
   */
  app.get("/api/paper-trading/performance", requireUser(), async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;

      const performance = paperTradingService.getUserPerformance(userId);
      res.json(performance);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch performance metrics";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/paper-trading/monitor/status
   * Get position monitor status
   * Required role: user
   */
  app.get("/api/paper-trading/monitor/status", requireUser(), async (req: Request, res: Response) => {
    try {
      const status = paperTradingService.getMonitorStatus();
      res.json(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch monitor status";
      res.status(500).json({ error: message });
    }
  });
}
