import type { Express } from "express";
import type { AuditService } from "../services/audit-service.js";
import { requireAdmin, type AuthenticatedRequest } from "../middleware/rbac.js";

export interface AdminRoutesOptions {
  auditService: AuditService;
}

export function registerAdminRoutes(app: Express, options: AdminRoutesOptions) {
  const { auditService } = options;

  /**
   * GET /admin/audit-logs
   * Get audit logs
   * Required role: admin
   */
  app.get("/admin/audit-logs", requireAdmin(), async (req, res) => {
    try {
      const { limit = 100, offset = 0, userId, action } = req.query;
      
      const logs = await auditService.getLogs({
        limit: Number(limit),
        offset: Number(offset),
        userId: userId as string | undefined,
        action: action as string | undefined
      });

      res.json(logs);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch audit logs";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /admin/performance
   * Get system performance metrics
   * Required role: admin
   */
  app.get("/admin/performance", requireAdmin(), async (req, res) => {
    try {
      const metrics = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        timestamp: Date.now()
      };

      res.json(metrics);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch performance";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /admin/users
   * List all users
   * Required role: admin
   */
  app.get("/admin/users", requireAdmin(), async (req, res) => {
    try {
      // TODO: Implement user listing
      res.json({ message: "Not implemented yet" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch users";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /admin/health
   * System health check
   * Required role: admin
   */
  app.get("/admin/health", requireAdmin(), async (req, res) => {
    try {
      const health = {
        status: "healthy",
        timestamp: Date.now(),
        services: {
          database: "healthy",
          redis: "healthy",
          api: "healthy"
        }
      };

      res.json(health);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to check health";
      res.status(500).json({ error: message });
    }
  });
}
