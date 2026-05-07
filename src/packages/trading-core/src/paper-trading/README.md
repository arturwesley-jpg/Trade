# Paper Trading System v2

Enhanced paper trading system with automated TP/SL execution, real-time mark-to-market PnL, and comprehensive performance analytics.

## Features

### 1. Mark-to-Market PnL
- Real-time position valuation based on current market prices
- Unrealized PnL calculation for open positions
- Realized PnL tracking for closed positions
- Daily/weekly/monthly performance metrics

### 2. Automated TP/SL Execution
- Background worker monitors positions every 5 seconds
- Auto-close when take-profit levels are hit
- Auto-close when stop-loss is triggered
- Trailing stop-loss support with dynamic adjustment
- Partial TP support (multiple take-profit levels)

### 3. Trade History & Analytics
- Complete trade log with entry/exit details
- Win rate calculation
- Average profit/loss metrics
- Maximum drawdown tracking
- Sharpe ratio calculation
- Risk/reward ratio per trade
- Time-series analysis (daily/weekly/monthly)

### 4. Position Management
- Long and short positions
- Leverage support
- Margin tracking
- Fee calculation (maker/taker)
- Position status tracking

## Architecture

```
paper-trading/
├── types.ts                      # TypeScript interfaces
├── position-manager.ts           # Core position management
├── performance-analytics.ts      # Metrics calculation
├── position-monitor-worker.ts    # Background TP/SL monitor
├── paper-trading-service.ts      # Main service orchestrator
└── index.ts                      # Module exports
```

## Usage

### Initialize Service

```typescript
import { PaperTradingService } from "@trade/trading-core";

const service = new PaperTradingService(
  {
    makerFeePct: 0.075,        // 0.075% maker fee
    takerFeePct: 0.075,        // 0.075% taker fee
    slippagePct: 0.05,         // 0.05% slippage
    monitorIntervalMs: 5000,   // Check positions every 5s
    enableAutoClose: true      // Enable automated TP/SL
  },
  10000 // Initial balance: $10,000
);

// Start monitoring
service.start();
```

### Open Position

```typescript
const position = service.openPosition({
  userId: "user123",
  symbol: "BTC-USDT",
  side: "long",
  entryPrice: 100000,
  quantity: 0.1,
  leverage: 10,
  marginUsdt: 1000,
  takeProfit: [105000, 110000],  // Multiple TP levels
  stopLoss: 98000,
  trailingStop: {
    distance: 2  // 2% trailing stop
  }
});
```

### Update Position

```typescript
const updated = service.updatePosition(position.id, {
  takeProfit: [106000],
  stopLoss: 99000,
  trailingStop: { distance: 1.5 }
});
```

### Close Position

```typescript
const trade = service.closePosition(position.id, {
  exitPrice: 105000,
  reason: 'MANUAL'
});
```

### Get Performance Metrics

```typescript
const metrics = service.getUserPerformance("user123");

console.log({
  totalTrades: metrics.totalTrades,
  winRate: metrics.winRate,
  totalPnL: metrics.totalPnL,
  sharpeRatio: metrics.sharpeRatio,
  maxDrawdown: metrics.maxDrawdown
});
```

### Real-time Price Updates

```typescript
// Update single price
service.updateMarketPrice("BTC-USDT", 101000);

// Update multiple prices
const prices = new Map([
  ["BTC-USDT", 101000],
  ["ETH-USDT", 3500]
]);
service.updateMarketPrices(prices);
```

### Position Close Events

```typescript
service.onPositionClose((event) => {
  console.log(`Position ${event.positionId} closed`);
  console.log(`Reason: ${event.reason}`);
  console.log(`PnL: ${event.pnl}`);
  
  // Send notification, update UI, etc.
});
```

## API Endpoints

### POST /api/paper-trading/positions
Open a new position.

**Request:**
```json
{
  "symbol": "BTC-USDT",
  "side": "long",
  "entryPrice": 100000,
  "quantity": 0.1,
  "leverage": 10,
  "marginUsdt": 1000,
  "takeProfit": [105000, 110000],
  "stopLoss": 98000,
  "trailingStop": {
    "distance": 2
  }
}
```

**Response:**
```json
{
  "id": "pos_abc123",
  "userId": "user123",
  "symbol": "BTC-USDT",
  "side": "long",
  "entryPrice": 100000,
  "currentPrice": 100000,
  "quantity": 0.1,
  "leverage": 10,
  "marginUsdt": 1000,
  "unrealizedPnL": 0,
  "status": "OPEN",
  "openedAt": 1714915283107
}
```

### GET /api/paper-trading/positions
List user's positions.

**Query params:**
- `status` (optional): "OPEN" | "CLOSED"

### GET /api/paper-trading/positions/:id
Get specific position details.

### PUT /api/paper-trading/positions/:id
Update position TP/SL.

**Request:**
```json
{
  "takeProfit": [106000],
  "stopLoss": 99000,
  "trailingStop": {
    "distance": 1.5
  }
}
```

### DELETE /api/paper-trading/positions/:id
Close position manually.

**Request:**
```json
{
  "exitPrice": 105000
}
```

### GET /api/paper-trading/history
Get trade history.

**Query params:**
- `limit` (optional): number of trades to return

### GET /api/paper-trading/performance
Get performance metrics.

**Response:**
```json
{
  "totalTrades": 50,
  "winningTrades": 32,
  "losingTrades": 18,
  "winRate": 64,
  "totalPnL": 2500,
  "totalPnLPercentage": 25,
  "averageWin": 150,
  "averageLoss": 80,
  "largestWin": 500,
  "largestLoss": -200,
  "profitFactor": 1.875,
  "sharpeRatio": 1.45,
  "maxDrawdown": 800,
  "maxDrawdownPercentage": 8,
  "averageRiskReward": 1.875,
  "averageTradeDuration": 3600000,
  "dailyMetrics": [...],
  "weeklyMetrics": [...],
  "monthlyMetrics": [...]
}
```

### GET /api/paper-trading/monitor/status
Get monitor status.

**Response:**
```json
{
  "isRunning": true,
  "openPositions": 5,
  "trackedSymbols": 10
}
```

## Configuration

Enable paper trading v2 in your app initialization:

```typescript
const app = await createApp({
  enablePaperTradingV2: true,
  accountEquity: 10000,
  // ... other options
});
```

## Performance Metrics Explained

- **Win Rate**: Percentage of profitable trades
- **Profit Factor**: Ratio of total wins to total losses
- **Sharpe Ratio**: Risk-adjusted return metric
- **Max Drawdown**: Largest peak-to-trough decline
- **Risk/Reward Ratio**: Average win divided by average loss

## Trailing Stop Logic

For **long positions**:
- Tracks highest price since activation
- Triggers when price drops by `distance` % from highest

For **short positions**:
- Tracks lowest price since activation
- Triggers when price rises by `distance` % from lowest

## Fee Calculation

- Entry fee: `entryPrice * quantity * takerFeePct / 100`
- Exit fee: `exitPrice * quantity * takerFeePct / 100`
- Total fees deducted from PnL

## Integration with Worker

The worker service automatically updates prices:

```typescript
// In worker.ts
redisSubscriber.onTick((tick) => {
  paperTradingService.updateMarketPrice(tick.symbol, tick.price);
});
```

## Testing

```bash
# Run tests
npm test packages/trading-core/src/paper-trading

# Build
npm run build
```

## License

MIT
