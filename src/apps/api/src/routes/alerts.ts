/**
 * Alert API Routes
 * Enhanced alert management with notification integration
 */

import type { Express } from "express";
import type { AlertService } from "../services/alert-service.js";
import type { CreateAlertRuleRequest, UpdateAlertRuleRequest } from "@trade/trading-core/alerts";
import { requireUser, type AuthenticatedRequest } from "../middleware/rbac.js";

export interface AlertRoutesOptions {
  alertService: AlertService;
}

export function registerAlertRoutes(app: Express, options: AlertRoutesOptions) {
  const { alertService } = options;

  /**
   * Create alert rule
   * POST /alerts
   */
  app.post("/alerts", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const request = req.body as CreateAlertRuleRequest;

      const alert = await alertService.createAlert(userId, request);

      res.status(201).json({
        success: true,
        alert,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create alert",
      });
    }
  });

  /**
   * Get user alerts
   * GET /alerts
   */
  app.get("/alerts", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;

      const alerts = await alertService.getAlertsByUserId(userId);

      res.json({
        success: true,
        alerts,
        count: alerts.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get alerts",
      });
    }
  });

  /**
   * Get specific alert
   * GET /alerts/:id
   */
  app.get("/alerts/:id", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const alert = await alertService.getAlert(userId, id);

      if (!alert) {
        return res.status(404).json({
          success: false,
          error: "Alert not found",
        });
      }

      res.json({
        success: true,
        alert,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get alert",
      });
    }
  });

  /**
   * Update alert
   * PUT /alerts/:id
   */
  app.put("/alerts/:id", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const request = req.body as UpdateAlertRuleRequest;

      const alert = await alertService.updateAlert(userId, id, request);

      if (!alert) {
        return res.status(404).json({
          success: false,
          error: "Alert not found",
        });
      }

      res.json({
        success: true,
        alert,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update alert",
      });
    }
  });

  /**
   * Delete alert
   * DELETE /alerts/:id
   */
  app.delete("/alerts/:id", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const deleted = await alertService.deleteAlert(userId, id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Alert not found",
        });
      }

      res.json({
        success: true,
        message: "Alert deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete alert",
      });
    }
  });

  /**
   * Get alert events
   * GET /alerts/events
   */
  app.get("/alerts/events", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      const events = await alertService.getAlertEvents(userId, limit);

      res.json({
        success: true,
        events,
        count: events.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get alert events",
      });
    }
  });

  /**
   * Acknowledge alert event
   * POST /alerts/events/:id/acknowledge
   */
  app.post("/alerts/events/:id/acknowledge", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const acknowledged = await alertService.acknowledgeEvent(userId, id);

      if (!acknowledged) {
        return res.status(404).json({
          success: false,
          error: "Event not found",
        });
      }

      res.json({
        success: true,
        message: "Event acknowledged",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to acknowledge event",
      });
    }
  });

  /**
   * Snooze alert event
   * POST /alerts/events/:id/snooze
   */
  app.post("/alerts/events/:id/snooze", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { durationMinutes } = req.body;

      if (!durationMinutes || durationMinutes <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid duration",
        });
      }

      const snoozed = await alertService.snoozeEvent(userId, id, durationMinutes);

      if (!snoozed) {
        return res.status(404).json({
          success: false,
          error: "Event not found",
        });
      }

      res.json({
        success: true,
        message: `Event snoozed for ${durationMinutes} minutes`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to snooze event",
      });
    }
  });

  /**
   * Pause alert rule
   * POST /alerts/:id/pause
   */
  app.post("/alerts/:id/pause", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const alert = await alertService.pauseAlert(userId, id);

      if (!alert) {
        return res.status(404).json({
          success: false,
          error: "Alert not found",
        });
      }

      res.json({
        success: true,
        alert,
        message: "Alert paused",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to pause alert",
      });
    }
  });

  /**
   * Resume alert rule
   * POST /alerts/:id/resume
   */
  app.post("/alerts/:id/resume", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const alert = await alertService.resumeAlert(userId, id);

      if (!alert) {
        return res.status(404).json({
          success: false,
          error: "Alert not found",
        });
      }

      res.json({
        success: true,
        alert,
        message: "Alert resumed",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to resume alert",
      });
    }
  });

  /**
   * Get alert statistics
   * GET /alerts/statistics
   */
  app.get("/alerts/statistics", requireUser(), async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;

      const statistics = await alertService.getAlertStatistics(userId);

      res.json({
        success: true,
        statistics,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get statistics",
      });
    }
  });
}
