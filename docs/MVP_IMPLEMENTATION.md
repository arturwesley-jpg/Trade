# MVP Paper-First Implementation

This repository now contains a runnable MVP foundation for the crypto trading bot plan.

## What Exists

- `packages/shared`: shared trading, market, risk, signal, audit, and position types.
- `packages/trading-core`: risk engine, deterministic signal engine, in-memory repository, and paper executor.
- `packages/exchange`: BingX subscription builder, message normalizer, and configurable WebSocket stream client.
- `apps/api`: Fastify API with health, ticker, signals, positions, trades, audit, paper open, and paper close endpoints.
- `apps/web`: React/Vite dashboard for market overview, informational signals, and simulated paper LONG entries.
- `apps/worker`: market stream worker with BingX WebSocket or simulated feed mode.
- `apps/telegram-bot`: safe Telegram bot with status, signals, and positions commands.
- `infra/docker-compose.yml`: local no-cost startup path.

## Safety Defaults

- Live trading is blocked by default.
- The API accepts only `mode: "paper"` at `/orders/paper`.
- Initial symbols are `BTC-USDT` and `ETH-USDT`.
- Initial risk engine is long-only.
- Stop loss is required.
- Paper leverage allows up to `4x`; live leverage is capped at `2x` but live is disabled.
- Informational signals set `shouldExecute: false`.

## Local Run

```bash
npm install
npm test
npm run build
npm start -w apps/api
npm run dev:web
```

Optional worker:

```bash
USE_SIMULATED_MARKET=true npm run dev:worker
```

Optional Telegram bot:

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_ALLOWED_USER_IDS=123 npm run dev:telegram
```

## Required Before Real Trading

- Confirm the exact BingX product and current official endpoints.
- Replace in-memory repository with durable PostgreSQL/SQLite storage.
- Add encrypted API key storage.
- Add exchange account/position reconciliation.
- Add idempotent live order placement with exchange order IDs.
- Run at least 100 paper trades over 30 days with fees, slippage, funding, and audit review.
