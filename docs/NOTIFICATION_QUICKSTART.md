# Notification System - Quick Start Guide

## Installation

### 1. Install Dependencies

```bash
# Core dependencies
npm install pg express

# Optional: For production email/SMS
npm install nodemailer twilio web-push
```

### 2. Set Up Database

```bash
# Create database
createdb trading_platform

# Run schema
psql -U postgres -d trading_platform -f packages/trading-core/src/notifications/schema.sql
```

### 3. Configure Environment

Create `.env` file:

```bash
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=trading_platform
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password

# Email (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME=Trading Platform
SMTP_FROM_ADDRESS=noreply@tradingplatform.com

# SMS (Twilio - optional)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890

# Push Notifications (optional)
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@tradingplatform.com

# Telegram (optional)
TELEGRAM_BOT_TOKEN=your-bot-token

# Worker
NOTIFICATION_WORKER_POLL_INTERVAL_MS=5000
NOTIFICATION_WORKER_BATCH_SIZE=100
```

## Basic Usage

### Send a Simple Notification

```typescript
import { Client } from "pg";
import { NotificationManager } from "@trade/trading-core/notifications";

// Connect to database
const client = new Client({
  host: "localhost",
  port: 5432,
  database: "trading_platform",
  user: "postgres",
  password: "postgres"
});
await client.connect();

// Create notification manager
const manager = new NotificationManager(client, {
  email: {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "your-email@gmail.com",
      pass: "your-app-password"
    },
    from: {
      name: "Trading Platform",
      address: "noreply@tradingplatform.com"
    }
  }
});

// Send notification
await manager.send({
  userId: "user-123",
  channels: ["email", "in-app"],
  priority: "high",
  title: "Price Alert",
  body: "BTC has reached $50,000!",
  data: {
    symbol: "BTC",
    price: 50000
  }
});

console.log("Notification sent!");
```

### Start Background Worker

```typescript
import { startNotificationWorker } from "@trade/trading-core/notifications";

const worker = await startNotificationWorker({
  database: {
    host: "localhost",
    port: 5432,
    database: "trading_platform",
    user: "postgres",
    password: "postgres"
  },
  notifications: {
    email: { /* config */ }
  }
});

console.log("Worker started!");
```

### Configure User Preferences

```typescript
// Get current preferences
const prefs = await manager.getPreferences("user-123");

// Update preferences
await manager.updatePreferences("user-123", {
  channels: {
    email: {
      enabled: true,
      address: "user@example.com",
      verified: true
    },
    telegram: {
      enabled: true,
      chatId: "123456789"
    }
  },
  quietHours: {
    enabled: true,
    start: "22:00",
    end: "08:00",
    timezone: "America/New_York"
  }
});
```

### Create Alert

```typescript
// Price alert
await alertEngine.createAlert({
  userId: "user-123",
  type: "price",
  name: "BTC $50k Alert",
  conditions: [
    {
      field: "price",
      operator: ">=",
      value: 50000
    }
  ],
  symbol: "BTC",
  priority: "high",
  notificationChannels: ["email", "telegram"]
});
```

## API Examples

### Send Notification via API

```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "channels": ["email", "push"],
    "priority": "high",
    "title": "Price Alert",
    "body": "BTC has reached $50,000",
    "data": {
      "symbol": "BTC",
      "price": 50000
    }
  }'
```

### Get Notification History

```bash
curl http://localhost:3000/api/notifications/history?limit=10
```

### Update Preferences

```bash
curl -X PUT http://localhost:3000/api/notifications/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "channels": {
      "email": {
        "enabled": true,
        "address": "user@example.com",
        "verified": true
      }
    }
  }'
```

### Create Alert

```bash
curl -X POST http://localhost:3000/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "type": "price",
    "name": "BTC Price Alert",
    "conditions": [
      {
        "field": "price",
        "operator": ">=",
        "value": 50000
      }
    ],
    "symbol": "BTC",
    "priority": "high",
    "notificationChannels": ["email", "telegram"]
  }'
```

## Channel Setup

### Email (Gmail)

1. Enable 2FA on your Google account
2. Generate app password: https://myaccount.google.com/apppasswords
3. Use app password in `SMTP_PASS`

### Telegram

1. Create bot via @BotFather
2. Get bot token
3. User starts chat with bot
4. Get chat ID: `https://api.telegram.org/bot<TOKEN>/getUpdates`
5. User adds chat ID to preferences

### Discord

1. Go to Server Settings → Integrations → Webhooks
2. Create webhook
3. Copy webhook URL
4. User adds URL to preferences

### Slack

1. Go to Workspace Settings → Apps → Incoming Webhooks
2. Create webhook
3. Copy webhook URL
4. User adds URL to preferences

## Testing

### Test Email

```bash
curl -X POST http://localhost:3000/api/notifications/test \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "email"
  }'
```

### Test All Channels

```typescript
const channels = ["email", "sms", "push", "telegram", "discord", "slack"];

for (const channel of channels) {
  try {
    await manager.send({
      userId: "user-123",
      channels: [channel],
      priority: "low",
      title: "Test Notification",
      body: `Testing ${channel} channel`
    });
    console.log(`✓ ${channel} test sent`);
  } catch (error) {
    console.error(`✗ ${channel} test failed:`, error);
  }
}
```

## Common Issues

### Notifications Not Sending

1. Check worker is running
2. Verify database connection
3. Check channel configuration
4. Review logs for errors

### Email Not Delivering

1. Check spam folder
2. Verify SMTP credentials
3. Test with different email provider
4. Check email address is correct

### SMS Not Working

1. Verify Twilio credentials
2. Check phone number format (E.164)
3. Verify account balance
4. Check Twilio console for errors

## Next Steps

- Read full documentation: `docs/NOTIFICATION_SYSTEM.md`
- Review examples: `examples/notification-integration.ts`
- Set up monitoring and alerts
- Configure production channels
- Implement custom notification templates
- Add notification analytics

## Support

- GitHub: https://github.com/your-org/trading-platform
- Docs: https://docs.tradingplatform.com
- Email: support@tradingplatform.com
