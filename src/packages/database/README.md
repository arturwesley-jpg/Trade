# Database Package

Database layer for Trading Bot with PostgreSQL support.

## Features

- **Type-safe repositories** for all data models
- **Migration system** with versioning
- **Connection pooling** with pg-pool
- **Transaction support**
- **Materialized views** for performance metrics

## Installation

```bash
npm install
npm run build
```

## Configuration

Set environment variables:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trading_bot
DB_USER=postgres
DB_PASSWORD=postgres
```

## Migrations

Run migrations:

```bash
# Run all pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Check migration status
npm run migrate:status
```

## Usage

### Initialize Database Client

```typescript
import { createDatabaseClient } from '@trading-bot/database';

const db = createDatabaseClient({
  host: 'localhost',
  port: 5432,
  database: 'trading_bot',
  user: 'postgres',
  password: 'postgres',
});
```

### Use Repositories

```typescript
import {
  PostgresMarketTickRepository,
  PostgresCandleRepository,
  PostgresSignalRepository,
  PostgresPositionRepository,
} from '@trading-bot/database';

// Market ticks
const tickRepo = new PostgresMarketTickRepository(db);
const tick = await tickRepo.create({
  symbol: 'BTC-USDT',
  price: '50000.00',
  volume: '1.5',
  timestamp: new Date(),
  provider: 'binance',
});

// Candles
const candleRepo = new PostgresCandleRepository(db);
const candles = await candleRepo.findBySymbolAndInterval('BTC-USDT', '1m', 100);

// Signals
const signalRepo = new PostgresSignalRepository(db);
const signals = await signalRepo.findExecutable(0.8);

// Positions
const positionRepo = new PostgresPositionRepository(db);
const openPositions = await positionRepo.findOpen('PAPER');
```

## Database Schema

### Tables

- `market_ticks` - Real-time market tick data
- `ohlcv_candles` - OHLCV candle data
- `signals` - Trading signals
- `positions` - Open and closed positions
- `trades` - Trade history
- `alerts` - Alert instances
- `alert_rules` - Alert rule definitions
- `whale_events` - Whale activity tracking
- `news_events` - News and events
- `sentiment_snapshots` - Sentiment analysis data
- `audit_logs` - Audit trail

### Indexes

All tables have optimized indexes for:
- Symbol lookups
- Time-range queries
- Status filtering
- Composite queries

### Materialized Views

- `trading_metrics` - Aggregated trading performance metrics

## Repository Methods

### MarketTickRepository

- `create(tick)` - Create new tick
- `findBySymbol(symbol, limit)` - Find ticks by symbol
- `findByTimeRange(symbol, start, end)` - Find ticks in time range
- `getLatest(symbol)` - Get latest tick
- `deleteOlderThan(date)` - Cleanup old ticks

### CandleRepository

- `create(candle)` - Create new candle
- `findBySymbolAndInterval(symbol, interval, limit)` - Find candles
- `findByTimeRange(symbol, interval, start, end)` - Find in range
- `getLatest(symbol, interval)` - Get latest candle
- `upsert(candle)` - Insert or update candle

### SignalRepository

- `create(signal)` - Create new signal
- `findBySymbol(symbol, limit)` - Find signals by symbol
- `findByType(type, limit)` - Find by type (BUY/SELL/NEUTRAL)
- `findExecutable(minConfidence)` - Find executable signals
- `findByTimeRange(start, end)` - Find in time range

### PositionRepository

- `create(position)` - Create new position
- `findById(id)` - Find by ID
- `findBySymbol(symbol)` - Find by symbol
- `findOpen(mode)` - Find open positions
- `update(id, updates)` - Update position
- `close(id, price, pnl)` - Close position

### TradeRepository

- `create(trade)` - Create new trade
- `findByPositionId(positionId)` - Find trades for position
- `findBySymbol(symbol, limit)` - Find by symbol
- `findByMode(mode, limit)` - Find by mode (PAPER/LIVE)
- `findByTimeRange(start, end)` - Find in time range

### AlertRepository

- `create(alert)` - Create new alert
- `findById(id)` - Find by ID
- `findByStatus(status, limit)` - Find by status
- `findBySeverity(severity, limit)` - Find by severity
- `acknowledge(id)` - Acknowledge alert
- `resolve(id)` - Resolve alert

### AlertRuleRepository

- `create(rule)` - Create new rule
- `findById(id)` - Find by ID
- `findEnabled()` - Find enabled rules
- `update(id, updates)` - Update rule
- `delete(id)` - Delete rule

## Performance

- Connection pooling (max 20 connections)
- Prepared statements
- Indexed queries
- Materialized views for aggregations
- Efficient time-series queries

## Testing

```bash
npm test
```

## License

MIT
