/**
 * Notification API Routes
 * Comprehensive notification and alerting endpoints
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { NotificationManager } from "@trade/trading-core/notifications";
import type {
  SendNotificationRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  UpdatePreferencesRequest,
  PushSubscription
} from "@trade/trading-core/notifications";
import { logger } from "@trade/shared/logger";

const router = Router();

// Middleware to get notification manager from request
// In production, this would be injected via dependency injection
function getNotificationManager(req: Request): NotificationManager {
  // @ts-ignore - Attached by app middleware
  return req.app.locals.notificationManager;
}

// Middleware to get authenticated user ID
function getUserId(req: Request): string {
  // @ts-ignore - Attached by auth middleware
  return req.user?.id || "anonymous";
}

/**
 * Send notification
 * POST /api/notifications/send
 */
router.post("/send", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const manager = getNotificationManager(req);

    const request: SendNotificationRequest = {
      userId: req.body.userId || userId,
      channels: req.body.channels,
      priority: req.body.priority,
      subject: req.body.subject,
      title: req.body.title,
      body: req.body.body,
      data: req.body.data,
      templateId: req.body.templateId,
      alertEventId: req.body.alertEventId,
      scheduledFor: req.body.scheduledFor
    };

    // Validate required fields
    if (!request.channels || !Array.isArray(request.channels) || request.channels.length === 0) {
      return res.status(400).json({
        error: "channels must be a non-empty array"
      });
    }

    if (!request.priority) {
      return res.status(400).json({
        error: "priority is required"
      });
    }

    if (!request.title || !request.body) {
      return res.status(400).json({
        error: "title and body are required"
      });
    }

    const notificationIds = await manager.send(request);

    res.status(200).json({
      success: true,
      notificationIds,
      message: `Notification queued for ${notificationIds.length} channel(s)`
    });
  } catch (error) {
    logger.error("Failed to send notification", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to send notification",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get notification history
 * GET /api/notifications/history
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const manager = getNotificationManager(req);

    const options = {
      channel: req.query.channel as string | undefined,
      status: req.query.status as string | undefined,
      priority: req.query.priority as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0
    };

    const history = await manager.getHistory(userId, options);

    res.status(200).json({
      success: true,
      ...history
    });
  } catch (error) {
    logger.error("Failed to get notification history", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to get notification history",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get notification statistics
 * GET /api/notifications/stats
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const manager = getNotificationManager(req);

    const stats = await manager.getStats(userId);

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error("Failed to get notification stats", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to get notification stats",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get notification preferences
 * GET /api/notifications/preferences
 */
router.get("/preferences", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const manager = getNotificationManager(req);

    const preferences = await manager.getPreferences(userId);

    res.status(200).json({
      success: true,
      preferences
    });
  } catch (error) {
    logger.error("Failed to get notification preferences", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to get notification preferences",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Update notification preferences
 * PUT /api/notifications/preferences
 */
router.put("/preferences", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const manager = getNotificationManager(req);

    const updates: UpdatePreferencesRequest = req.body;

    const preferences = await manager.updatePreferences(userId, updates);

    res.status(200).json({
      success: true,
      preferences,
      message: "Preferences updated successfully"
    });
  } catch (error) {
    logger.error("Failed to update notification preferences", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to update notification preferences",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Add push subscription
 * POST /api/notifications/push/subscribe
 */
router.post("/push/subscribe", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const manager = getNotificationManager(req);

    const subscription: PushSubscription = {
      endpoint: req.body.endpoint,
      keys: req.body.keys,
      userAgent: req.headers["user-agent"],
      createdAt: new Date().toISOString()
    };

    // Validate subscription
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return res.status(400).json({
        error: "Invalid push subscription format"
      });
    }

    await manager.addPushSubscription(userId, subscription);

    res.status(200).json({
      success: true,
      message: "Push subscription added successfully"
    });
  } catch (error) {
    logger.error("Failed to add push subscription", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to add push subscription",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Remove push subscription
 * POST /api/notifications/push/unsubscribe
 */
router.post("/push/unsubscribe", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const manager = getNotificationManager(req);

    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        error: "endpoint is required"
      });
    }

    await manager.removePushSubscription(userId, endpoint);

    res.status(200).json({
      success: true,
      message: "Push subscription removed successfully"
    });
  } catch (error) {
    logger.error("Failed to remove push subscription", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to remove push subscription",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Create notification template
 * POST /api/notifications/templates
 */
router.post("/templates", async (req: Request, res: Response) => {
  try {
    const manager = getNotificationManager(req);

    const request: CreateTemplateRequest = {
      name: req.body.name,
      description: req.body.description,
      channel: req.body.channel,
      subject: req.body.subject,
      body: req.body.body,
      variables: req.body.variables
    };

    // Validate required fields
    if (!request.name || !request.channel || !request.body || !request.variables) {
      return res.status(400).json({
        error: "name, channel, body, and variables are required"
      });
    }

    const template = await manager.createTemplate(request);

    res.status(201).json({
      success: true,
      template,
      message: "Template created successfully"
    });
  } catch (error) {
    logger.error("Failed to create notification template", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to create notification template",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get notification templates
 * GET /api/notifications/templates
 */
router.get("/templates", async (req: Request, res: Response) => {
  try {
    const manager = getNotificationManager(req);

    const channel = req.query.channel as string | undefined;
    const templates = await manager.getTemplates(channel);

    res.status(200).json({
      success: true,
      templates,
      count: templates.length
    });
  } catch (error) {
    logger.error("Failed to get notification templates", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to get notification templates",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Update notification template
 * PUT /api/notifications/templates/:id
 */
router.put("/templates/:id", async (req: Request, res: Response) => {
  try {
    const manager = getNotificationManager(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const updates: UpdateTemplateRequest = {
      name: req.body.name,
      description: req.body.description,
      subject: req.body.subject,
      body: req.body.body,
      variables: req.body.variables
    };

    const template = await manager.updateTemplate(id, updates);

    res.status(200).json({
      success: true,
      template,
      message: "Template updated successfully"
    });
  } catch (error) {
    logger.error("Failed to update notification template", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to update notification template",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Delete notification template
 * DELETE /api/notifications/templates/:id
 */
router.delete("/templates/:id", async (req: Request, res: Response) => {
  try {
    const manager = getNotificationManager(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    await manager.deleteTemplate(id);

    res.status(200).json({
      success: true,
      message: "Template deleted successfully"
    });
  } catch (error) {
    logger.error("Failed to delete notification template", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to delete notification template",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Test notification delivery
 * POST /api/notifications/test
 */
router.post("/test", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const manager = getNotificationManager(req);

    const { channel } = req.body;

    if (!channel) {
      return res.status(400).json({
        error: "channel is required"
      });
    }

    const notificationIds = await manager.send({
      userId,
      channels: [channel],
      priority: "low",
      title: "Test Notification",
      body: "This is a test notification from the Trading Platform.",
      data: {
        test: true,
        timestamp: new Date().toISOString()
      }
    });

    res.status(200).json({
      success: true,
      notificationIds,
      message: `Test notification sent via ${channel}`
    });
  } catch (error) {
    logger.error("Failed to send test notification", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to send test notification",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
