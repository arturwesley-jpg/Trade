import type { Express } from "express";
import type { OrderService } from "../services/order-service.js";
import { requireUser, type AuthenticatedRequest } from "../middleware/rbac.js";

export interface OrdersRoutesOptions {
  orderService: OrderService;
}

export function registerOrdersRoutes(app: Express, options: OrdersRoutesOptions) {
  const { orderService } = options;

  /**
   * POST /orders/paper
   * Create a paper trading order
   * Required role: user
   */
  app.post("/orders/paper", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const { symbol, side, quantity, price } = req.body;

      if (!symbol || !side || !quantity) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const order = await orderService.createOrder({
        userId,
        symbol,
        side,
        quantity,
        price
      });

      res.json(order);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create order";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /orders/paper
   * List user's paper orders
   * Required role: user
   */
  app.get("/orders/paper", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const orders = await orderService.getOrders(userId);
      res.json(orders);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch orders";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /orders/paper/positions
   * Get user's open positions
   * Required role: user
   */
  app.get("/orders/paper/positions", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const positions = await orderService.getPositions(userId);
      res.json(positions);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch positions";
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /orders/paper/close/:positionId
   * Close a paper position
   * Required role: user
   */
  app.post("/orders/paper/close/:positionId", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const positionId = Array.isArray(req.params.positionId) ? req.params.positionId[0] : req.params.positionId;
      const { exitPrice } = req.body;

      if (!exitPrice) {
        return res.status(400).json({ error: "exitPrice is required" });
      }

      await orderService.closePosition(userId, positionId, exitPrice);
      res.json({ success: true, message: "Position closed successfully" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to close position";
      res.status(500).json({ error: message });
    }
  });
}
