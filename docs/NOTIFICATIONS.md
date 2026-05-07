# Notification System Documentation

## Overview

The notification system provides a flexible, multi-channel notification delivery platform with support for batching, rate limiting, templates, and notification history tracking.

## Features

- **Multi-channel support**: Email, SMS, Push, Telegram, Webhook, Slack
- **Priority handling**: Low, Normal, High, Critical
- **Batching**: Group low-priority notifications to reduce overhead
- **Rate limiting**: Prevent notification spam with configurable limits
- **Templates**: Reusable notification templates with variable substitution
- **History tracking**: Query notification history with filters
- **Graceful degradation**: System continues working even if some channels fail

## Architecture

### Core Components

1. **NotificationService** - Central service managing all notifications
2. **NotificationHandlers** - Channel-specific implementations (Email, Telegram, etc.)
3. **Templates** - Reusable message templates
4. **History** - In-memory notification tracking

### Channel Handlers

#### EmailHandler
- Uses nodemailer for SMTP delivery
- HTML formatting with priority badges
- Configurable SMTP settings
- Verification support

#### TelegramHandler
- Telegram Bot API integration
- HTML formatting with emojis
- Metadata display
- Bot verification

#### WebhookHandler
- Generic HTTP webhook delivery
- Configurable method (POST/PUT)
- Custom headers support
- Automatic retries with exponential backoff
- Timeout handling

#### SlackHandler
- Supports both webhook and bot token modes
- Rich message formatting with blocks
- Priority color coding
- Channel routing

## Configuration

### Environment Variables

```bash
# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Trading Bot <noreply@tradingbot.com>

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token

# Webhook
WEBHOOK_URL=https://your-webhook-endpoint.com/notify
WEBHOOK_HEADERS={"Authorization":"Bearer token"}
WEBHOOK_TIMEOUT=10000
WEBHOOK_RETRIES=3

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
# OR
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_DEFAULT_CHANNEL=#alerts
```

## Usage

### Basic Notification

```typescript
import { notificationService } from "@trade/shared/notifications";

await notificationService.send({
  channel: "email",
  recipient: "user@example.com",
  subject: "Trade Executed",
  message: "Your BTC-USDT trade was executed successfully",
  priority: "normal"
});
```

### Multi-Channel Notification

```typescript
await notificationService.sendMulti({
  channels: ["email", "telegram", "slack"],
  recipient: "user@example.com",
  subject: "Critical Alert",
  message: "System detected unusual activity",
  priority: "critical"
});
```

### Template-Based Notification

```typescript
await notificationService.sendFromTemplate({
  channel: "email",
  recipient: "user@example.com",
  template: "trade-executed",
  data: {
    symbol: "BTC-USDT",
    side: "LONG",
    amount: "0.5",
    price: "100000",
    total: "50000",
    orderId: "order-123",
    timestamp: new Date().toISOString()
  },
  priority: "normal"
});
```

### Query Notification History

```typescript
const history = notificationService.getHistory({
  channel: "email",
  status: "sent",
  priority: "high",
  startDate: new Date("2026-05-01"),
  endDate: new Date("2026-05-03"),
  limit: 50
});
```

## API Endpoints

### POST /notifications
Send a single notification.

**Request:**
```json
{
  "channel": "email",
  "recipient": "user@example.com",
  "subject": "Test",
  "message": "Test message",
  "priority": "normal",
  "metadata": {
    "userId": "123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification sent successfully"
}
```

### POST /notifications/multi
Send notification to multiple channels.

**Request:**
```json
{
  "channels": ["email", "telegram"],
  "recipient": "user@example.com",
  "subject": "Alert",
  "message": "Important message",
  "priority": "high"
}
```

### POST /notifications/template
Send template-based notification.

**Request:**
```json
{
  "channel": "email",
  "recipient": "user@example.com",
  "template": "trade-executed",
  "data": {
    "symbol": "BTC-USDT",
    "side": "LONG",
    "amount": "0.5"
  },
  "priority": "normal"
}
```

### GET /notifications/history
Query notification history.

**Query Parameters:**
- `channel` - Filter by channel
- `recipient` - Filter by recipient
- `status` - Filter by status (pending, sent, failed, queued)
- `priority` - Filter by priority
- `startDate` - Filter by start date (ISO format)
- `endDate` - Filter by end date (ISO format)
- `limit` - Maximum results (default: 100)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "count": 10,
  "notifications": [
    {
      "id": "uuid",
      "channel": "email",
      "recipient": "user@example.com",
      "subject": "Test",
      "message": "Test message",
      "priority": "normal",
      "status": "sent",
      "sentAt": "2026-05-03T17:00:00Z",
      "createdAt": "2026-05-03T17:00:00Z"
    }
  ]
}
```

### GET /notifications/channels
Get available notification channels.

**Response:**
```json
{
  "success": true,
  "channels": ["email", "telegram", "webhook", "slack"]
}
```

## Built-in Templates

### trade-executed
Notification for executed trades.

**Variables:**
- `symbol` - Trading pair
- `side` - LONG or SHORT
- `amount` - Trade amount
- `price` - Execution price
- `total` - Total value
- `orderId` - Order ID
- `timestamp` - Execution timestamp

### position-opened
Notification for opened positions.

**Variables:**
- `symbol`, `side`, `size`, `entryPrice`, `stopLoss`, `takeProfit`, `positionId`, `timestamp`

### position-closed
Notification for closed positions.

**Variables:**
- `symbol`, `side`, `size`, `entryPrice`, `exitPrice`, `pnl`, `pnlPercent`, `positionId`, `timestamp`

### alert-triggered
Notification for triggered alerts.

**Variables:**
- `alertName`, `condition`, `currentValue`, `threshold`, `message`, `timestamp`

### risk-warning
Notification for risk warnings.

**Variables:**
- `warningType`, `severity`, `description`, `exposure`, `limit`, `action`, `timestamp`

### system-error
Notification for system errors.

**Variables:**
- `errorType`, `component`, `message`, `stackTrace`, `timestamp`

## Batching

Batching groups low-priority notifications to reduce overhead.

```typescript
notificationService.enableBatching("email", {
  interval: 60000, // 1 minute
  maxSize: 10      // Max 10 notifications per batch
});
```

**Behavior:**
- Critical and high priority notifications bypass batching
- Batch is flushed when maxSize is reached or interval expires
- Each notification in batch is sent individually

## Rate Limiting

Rate limiting prevents notification spam.

```typescript
notificationService.setRateLimit("telegram", {
  maxPerMinute: 20,
  maxPerHour: 100,
  maxPerDay: 500
});
```

**Behavior:**
- Notifications exceeding limits are queued
- Counters reset automatically (minute, hour, day)
- Queued notifications require manual retry

## Custom Handlers

Create custom notification handlers by implementing the `NotificationHandler` interface:

```typescript
import type { NotificationHandler, NotificationMessage } from "@trade/shared/notifications";

class CustomHandler implements NotificationHandler {
  async send(message: NotificationMessage): Promise<void> {
    // Your implementation
  }
}

// Register handler
const handler = new CustomHandler();
notificationService.registerHandler("custom", handler);
```

## Integration with Alerting System

The notification system integrates with the existing alerting system:

```typescript
import { alerting } from "@trade/shared";
import { notificationService } from "@trade/shared/notifications";

// Send alert via notification system
await notificationService.sendFromTemplate({
  channel: "telegram",
  recipient: process.env.TELEGRAM_ADMIN_CHAT_ID!,
  template: "alert-triggered",
  data: {
    alertName: "High Volatility",
    condition: "Price change > 5%",
    currentValue: "7.2%",
    threshold: "5%",
    message: "BTC-USDT volatility exceeded threshold",
    timestamp: new Date().toISOString()
  },
  priority: "high"
});
```

## Error Handling

All handlers implement graceful error handling:

- Errors are logged with structured logging
- Failed notifications are marked with status "failed"
- Error messages are stored in notification history
- System continues operating even if handlers fail

## Best Practices

1. **Use appropriate priorities**
   - Critical: System failures, security alerts
   - High: Trade executions, risk warnings
   - Normal: Regular updates, confirmations
   - Low: Informational messages, summaries

2. **Enable batching for low-priority channels**
   - Reduces overhead for email notifications
   - Groups similar notifications together

3. **Set rate limits**
   - Prevents notification spam
   - Protects against API rate limits

4. **Use templates**
   - Ensures consistent messaging
   - Simplifies notification creation
   - Easier to maintain and update

5. **Monitor notification history**
   - Track delivery success rates
   - Identify problematic channels
   - Audit notification activity

## Monitoring

Monitor notification system health:

```typescript
// Check available channels
const channels = ["email", "telegram", "webhook", "slack"];
const available = channels.filter(ch => 
  notificationService.hasHandler(ch as any)
);

// Query recent failures
const failures = notificationService.getHistory({
  status: "failed",
  limit: 10
});

// Track delivery rates
const sent = notificationService.getHistory({ status: "sent" });
const failed = notificationService.getHistory({ status: "failed" });
const deliveryRate = (sent.length / (sent.length + failed.length)) * 100;
```

## Troubleshooting

### Email not sending
- Verify SMTP credentials
- Check SMTP_HOST and SMTP_PORT
- Enable "Less secure app access" for Gmail
- Use app-specific password for Gmail

### Telegram not working
- Verify bot token is correct
- Ensure bot has permission to send messages
- Check recipient chat ID is valid
- Use @userinfobot to get your chat ID

### Webhook failing
- Verify webhook URL is accessible
- Check webhook endpoint accepts POST requests
- Verify custom headers are correct
- Check webhook timeout settings

### Slack not delivering
- Verify webhook URL or bot token
- Check channel permissions
- Ensure bot is added to channel (for bot mode)
- Verify Slack workspace settings

## Future Enhancements

- [ ] SMS handler implementation
- [ ] Push notification handler
- [ ] Persistent notification queue (Redis/PostgreSQL)
- [ ] Notification preferences per user
- [ ] Delivery retry mechanism for failed notifications
- [ ] Notification analytics dashboard
- [ ] A/B testing for notification templates
- [ ] Notification scheduling
- [ ] Rich media support (images, attachments)
- [ ] Notification grouping and threading
