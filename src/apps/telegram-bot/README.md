# Telegram Bot

Complete Telegram bot implementation for the crypto trading system with real-time signals, position monitoring, and performance metrics.

## Features

### Commands
- `/start` - Welcome message and main menu with interactive buttons
- `/help` - Complete command documentation
- `/status` - System status and account overview
- `/signals` - Current trading signals with confidence levels
- `/positions` - List all open positions with PnL
- `/trades` - Trade history (last 10 trades)
- `/metrics` - Performance and risk metrics
- `/alerts` - Active system alerts

### Security Features
- **User Authentication**: Whitelist-based access control
- **Rate Limiting**: Prevents spam (20 requests/minute per user by default)
- **Audit Logging**: All interactions logged with timestamp and user info
- **Admin Commands**: Restricted commands for administrators

### Interactive Features
- Inline keyboard buttons for quick navigation
- Real-time data refresh buttons
- Formatted messages with emojis and markdown
- Error handling with user-friendly messages

## Setup

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the instructions
3. Copy the bot token provided

### 2. Get Your User ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. Copy your user ID

### 3. Configure Environment Variables

Create a `.env` file in `apps/telegram-bot/`:

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather

# Required in production
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321

# Optional
TELEGRAM_ADMIN_IDS=123456789
API_BASE_URL=http://localhost:4000
APP_ENV=development
TELEGRAM_RATE_LIMIT_MAX=20
TELEGRAM_RATE_LIMIT_WINDOW_MS=60000
```

### 4. Install Dependencies

```bash
pnpm install
```

### 5. Start the Bot

Development mode with auto-reload:
```bash
pnpm dev
```

Production mode:
```bash
pnpm build
pnpm start
```

## Architecture

```
src/
├── index.ts              # Main bot entry point
├── commands/             # Command handlers
│   ├── start.ts         # /start command
│   ├── help.ts          # /help command
│   ├── status.ts        # /status command
│   ├── signals.ts       # /signals command
│   ├── positions.ts     # /positions command
│   ├── trades.ts        # /trades command
│   ├── metrics.ts       # /metrics command
│   └── alerts.ts        # /alerts command
├── middleware/          # Bot middleware
│   ├── auth.ts         # Authentication
│   ├── rate-limit.ts   # Rate limiting
│   └── audit.ts        # Audit logging
└── utils/              # Utilities
    ├── api.ts          # API client
    └── formatters.ts   # Message formatters
```

## Usage Examples

### Basic Commands

```
/start
# Shows welcome message with interactive menu

/status
# System Status
# Status: ok
# Mode: paper
# Live Trading: Disabled
# 
# Account Overview
# Open Positions: 2
# Total Trades: 15
# Win Rate: 66.7%
# Total PnL: +125.50 USDT

/signals
# Trading Signals
# 1. 🟢 BTC-USDT
# Direction: LONG
# Confidence: high
# Price Change: +2.5%
# Strong bullish momentum detected
```

### Interactive Buttons

All commands include refresh buttons for real-time updates:
- Click "🔄 Refresh" to update data
- Use inline menu buttons for quick navigation

## Rate Limiting

Default limits:
- 20 requests per minute per user
- Configurable via environment variables
- Automatic retry-after messages

## Audit Logging

All interactions are logged:
```
[2026-05-03T17:08:35.708Z] User 123456789 (username) - Command: /status
[AUDIT] 2026-05-03T17:08:35.708Z | User: 123456789 (username) | Command: /status
```

## Error Handling

- API errors are caught and formatted for users
- Network issues show friendly error messages
- Rate limit violations include retry-after time
- Authentication failures explain the reason

## Security

### Production Checklist

- [ ] Set `APP_ENV=production`
- [ ] Configure `TELEGRAM_ALLOWED_USER_IDS` with authorized users
- [ ] Set `TELEGRAM_ADMIN_IDS` for admin-only commands
- [ ] Use HTTPS for API_BASE_URL in production
- [ ] Monitor audit logs regularly
- [ ] Keep bot token secure (never commit to git)

### Access Control

In production mode:
- Empty whitelist blocks all users
- Only whitelisted users can use the bot
- Admin commands restricted to admin users
- All access attempts are logged

## Troubleshooting

### Bot doesn't respond
- Check `TELEGRAM_BOT_TOKEN` is correct
- Verify bot is running (`pnpm dev` or `pnpm start`)
- Check API is accessible at `API_BASE_URL`

### "Access denied" message
- Add your user ID to `TELEGRAM_ALLOWED_USER_IDS`
- Verify environment variables are loaded
- Check `APP_ENV` setting

### Rate limit errors
- Wait for the retry-after period
- Adjust `TELEGRAM_RATE_LIMIT_MAX` if needed
- Check for command loops or automation

### API errors
- Verify API is running at `API_BASE_URL`
- Check API logs for errors
- Test API endpoints directly with curl

## Development

### Adding New Commands

1. Create command handler in `src/commands/`:
```typescript
import type { Context } from "telegraf";
import type { ApiClient } from "../utils/api.js";

export async function handleMyCommand(ctx: Context, apiClient: ApiClient) {
  // Implementation
}
```

2. Register in `src/index.ts`:
```typescript
bot.command("mycommand", (ctx) => handleMyCommand(ctx, apiClient));
```

3. Add to help text in `src/commands/help.ts`

### Testing

Run tests:
```bash
pnpm test
```

## API Integration

The bot connects to the trading API at `API_BASE_URL` (default: `http://localhost:4000`).

Required API endpoints:
- `GET /health` - System health
- `GET /positions` - Open positions
- `GET /trades` - Trade history
- `GET /signals` - Trading signals
- `GET /alerts` - Active alerts
- `GET /paper-trading/status` - Paper trading metrics
- `GET /metrics/performance` - Performance metrics
- `GET /metrics/risk` - Risk metrics

## License

Private - Part of the Trade crypto trading system
