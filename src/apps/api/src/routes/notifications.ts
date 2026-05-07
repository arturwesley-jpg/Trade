import { Router } from "express";
import { notificationService } from "@trade/shared/notifications";
import type { NotificationRequest, NotificationHistoryQuery, NotificationChannel } from "@trade/shared/notifications";
import { logger } from "@trade/shared/logger";

const router = Router();

// Send notification
router.post("/", async (req, res) => {
  try {
    const request: NotificationRequest = req.body;

    if (!request.channel || !request.recipient || !request.message || !request.priority) {
      return res.status(400).json({
        error: "Missing required fields: channel, recipient, message, priority"
      });
    }

    await notificationService.send(request);

    res.status(200).json({
      success: true,
      message: "Notification sent successfully"
    });
  } catch (error) {
    logger.error("Failed to send notification", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to send notification",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Send multi-channel notification
router.post("/multi", async (req, res) => {
  try {
    const { channels, recipient, subject, message, priority, metadata } = req.body;

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({
        error: "channels must be a non-empty array"
      });
    }

    if (!recipient || !message || !priority) {
      return res.status(400).json({
        error: "Missing required fields: recipient, message, priority"
      });
    }

    await notificationService.sendMulti({
      channels,
      recipient,
      subject,
      message,
      priority,
      metadata
    });

    res.status(200).json({
      success: true,
      message: "Multi-channel notification sent successfully"
    });
  } catch (error) {
    logger.error("Failed to send multi-channel notification", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to send multi-channel notification",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Send template-based notification
router.post("/template", async (req, res) => {
  try {
    const { channel, recipient, template, data, priority, metadata } = req.body;

    if (!channel || !recipient || !template || !data || !priority) {
      return res.status(400).json({
        error: "Missing required fields: channel, recipient, template, data, priority"
      });
    }

    await notificationService.sendFromTemplate({
      channel,
      recipient,
      template,
      data,
      priority,
      metadata
    });

    res.status(200).json({
      success: true,
      message: "Template notification sent successfully"
    });
  } catch (error) {
    logger.error("Failed to send template notification", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to send template notification",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get notification history
router.get("/history", async (req, res) => {
  try {
    const channelValue = req.query.channel as string | undefined;
    const query: NotificationHistoryQuery = {
      channel: (channelValue && ["email", "sms", "push", "telegram", "discord", "webhook", "in-app"].includes(channelValue))
        ? channelValue as NotificationChannel
        : undefined,
      recipient: req.query.recipient as string | undefined,
      status: req.query.status as "pending" | "sent" | "failed" | "queued" | undefined,
      priority: req.query.priority as "low" | "normal" | "high" | "critical" | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined
    };

    const history = notificationService.getHistory(query);

    res.status(200).json({
      success: true,
      count: history.length,
      notifications: history
    });
  } catch (error) {
    logger.error("Failed to get notification history", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to get notification history",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get available channels
router.get("/channels", async (req, res) => {
  try {
    const channels = ["email", "sms", "push", "telegram", "webhook", "slack"];
    const availableChannels = channels.filter((channel) =>
      notificationService.hasHandler(channel as any)
    );

    res.status(200).json({
      success: true,
      channels: availableChannels
    });
  } catch (error) {
    logger.error("Failed to get available channels", { error: error instanceof Error ? error : String(error) });
    res.status(500).json({
      error: "Failed to get available channels",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
