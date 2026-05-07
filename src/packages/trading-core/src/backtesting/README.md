/**
 * Backtesting Documentation
 * Comprehensive guide for the backtesting engine
 */

# Backtesting Engine

A comprehensive backtesting system for validating trading strategies on historical data.

## Features

- **Multiple Strategy Support**: SMA Crossover, RSI Mean Reversion, MACD Crossover
- **Performance Metrics**: Win rate, Sharpe ratio, Sortino ratio, max drawdown, profit factor
- **Risk Management**: Stop loss, take profit, position sizing
- **Database Integration**: Fetch historical data from PostgreSQL
- **API Endpoints**: REST API for running and managing backtests

## Architecture

```
packages/trading-core/src/backtesting/
├── backtest-engine.ts          # Core backtesting engine
├── strategy-interface.ts       # Strategy contract
├── strategies/
│   ├── sma-crossover.ts       # SMA crossover strategy
│   ├── rsi-strategy.ts        # RSI mean reversion
│   ├── macd-strategy.ts       # MACD crossover
│   └── index.ts               # Strategy registry
├── performance-metrics.ts      # Metrics calculator
├── database-fetcher.ts        # PostgreSQL data fetcher
├── historical-data-fetcher.ts # External data fetcher
└── strategy-runner.ts         # Parameter optimization
```

## Usage

### 1. Basic Backtest

```typescript
import { BacktestEngine, SMACrossoverStrategy } from "@trade/trading-core";

const strategy = new SMACrossoverStrategy({
  fastPeriod: 10,
  slowPeriod: 20,
  stopLossPercent: 0.02,
  takeProfitPercent: 0.04
});

const engine = new BacktestEngine({
  symbol: "BTC-USDT",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-12-31"),
  initialCapital: 10000,
  feeRate: 0.001,
  slippageRate: 0.0005,
  maxLeverage: 1,
  riskPerTrade: 0.02,
  stopLossAtr: 2,
  takeProfitAtr: 3
});

const result = await engine.run(candles, strategy);
console.log(result);
```

### 2. API Usage

#### Run Backtest

```bash
POST /api/backtest
{
  "symbol": "BTC-USDT",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "strategy": "sma-crossover",
  "parameters": {
    "fastPeriod": 10,
    "slowPeriod": 20
  },
  "initialCapital": 10000,
  "commission": 0.001,
  "slippage": 0.0005,
  "interval": "1h"
}
```

#### Get Results

```bash
GET /api/backtest/:id
```

#### List Backtests

```bash
GET /api/backtest
```

#### List Available Strategies

```bash
GET /api/backtest/strategies
```

## Available Strategies

### 1. SMA Crossover

Trend-following strategy based on moving average crossovers.

**Parameters:**
- `fastPeriod` (default: 10): Fast MA period
- `slowPeriod` (default: 20): Slow MA period
- `stopLossPercent` (default: 0.02): Stop loss percentage
- `takeProfitPercent` (default: 0.04): Take profit percentage

**Signals:**
- Buy: Fast MA crosses above Slow MA
- Sell: Fast MA crosses below Slow MA

### 2. RSI Mean Reversion

Mean reversion strategy based on RSI overbought/oversold levels.

**Parameters:**
- `period` (default: 14): RSI period
- `oversoldThreshold` (default: 30): Oversold level
- `overboughtThreshold` (default: 70): Overbought level
- `stopLossPercent` (default: 0.03): Stop loss percentage
- `takeProfitPercent` (default: 0.05): Take profit percentage

**Signals:**
- Buy: RSI < oversold threshold
- Sell: RSI > overbought threshold

### 3. MACD Crossover

Momentum strategy based on MACD line and signal line crossovers.

**Parameters:**
- `fastPeriod` (default: 12): Fast EMA period
- `slowPeriod` (default: 26): Slow EMA period
- `signalPeriod` (default: 9): Signal line period
- `stopLossPercent` (default: 0.025): Stop loss percentage
- `takeProfitPercent` (default: 0.045): Take profit percentage

**Signals:**
- Buy: MACD line crosses above signal line
- Sell: MACD line crosses below signal line

## Performance Metrics

The backtesting engine calculates comprehensive performance metrics:

### Return Metrics
- Total Return (absolute and percentage)
- Annualized Return
- Monthly/Yearly Returns

### Trade Metrics
- Total Trades
- Winning/Losing Trades
- Win Rate
- Average Win/Loss
- Largest Win/Loss

### Risk Metrics
- Profit Factor
- Sharpe Ratio
- Sortino Ratio
- Calmar Ratio
- Maximum Drawdown

### Duration Metrics
- Average Trade Duration
- Average Win/Loss Duration

### Streak Metrics
- Maximum Consecutive Wins/Losses

### Risk/Reward
- Average Risk/Reward Ratio
- Expectancy (average profit per trade)

## Creating Custom Strategies

Implement the `TradingStrategy` interface:

```typescript
import { BaseStrategy, type StrategyContext, type TradingSignal } from "@trade/trading-core";

export class MyCustomStrategy extends BaseStrategy {
  name = "My Custom Strategy";
  description = "Description of my strategy";

  generateSignal(context: StrategyContext): TradingSignal | null {
    const { candles, currentIndex, currentPrice } = context;

    // Your strategy logic here
    if (/* buy condition */) {
      return {
        action: "BUY",
        confidence: 80,
        reasoning: "Buy signal detected"
      };
    }

    if (/* sell condition */) {
      return {
        action: "SELL",
        confidence: 80,
        reasoning: "Sell signal detected"
      };
    }

    return null;
  }

  calculateStopLoss(context: StrategyContext, signal: TradingSignal): number {
    // Custom stop loss logic
    return context.currentPrice * 0.98;
  }

  calculateTakeProfit(context: StrategyContext, signal: TradingSignal): number {
    // Custom take profit logic
    return context.currentPrice * 1.04;
  }
}
```

## Database Schema

```sql
CREATE TABLE backtests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  symbol VARCHAR(20) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  strategy VARCHAR(50) NOT NULL,
  parameters JSONB,
  status VARCHAR(20) NOT NULL,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP
);

CREATE INDEX idx_backtests_user_id ON backtests(user_id);
CREATE INDEX idx_backtests_status ON backtests(status);
```

## Best Practices

1. **Data Quality**: Ensure historical data is clean and complete
2. **Realistic Assumptions**: Use realistic commission and slippage rates
3. **Walk-Forward Testing**: Use walk-forward analysis for robust validation
4. **Multiple Timeframes**: Test strategies on different timeframes
5. **Out-of-Sample Testing**: Reserve data for out-of-sample validation
6. **Risk Management**: Always include stop loss and position sizing
7. **Overfitting**: Avoid over-optimizing parameters on historical data

## Limitations

- Past performance does not guarantee future results
- Market conditions change over time
- Slippage and commission estimates may not reflect reality
- Does not account for market impact on large orders
- Assumes perfect execution (no partial fills, rejections)

## Future Enhancements

- [ ] Multi-asset portfolio backtesting
- [ ] Monte Carlo simulation
- [ ] Walk-forward optimization
- [ ] Machine learning strategy integration
- [ ] Real-time strategy monitoring
- [ ] Advanced order types (limit, stop-limit)
- [ ] Margin and leverage simulation
- [ ] Transaction cost analysis
