import type { PaperOrderPayload } from '../../src/view-model.js';
import type { User, CreateBacktestRequest } from '@trade/shared';

/**
 * Authentication fixtures for E2E tests
 */
export const auth = {
  validUser: {
    email: 'test@example.com',
    password: 'Test123!@#',
    name: 'Test User'
  },
  adminUser: {
    email: 'admin@example.com',
    password: 'Admin123!@#',
    name: 'Admin User'
  },
  invalidUser: {
    email: 'invalid@example.com',
    password: 'wrongpassword'
  }
};

/**
 * Test user fixtures (legacy compatibility)
 */
export const testUsers = auth;

/**
 * Paper order fixtures
 */
export const paperOrders = {
  longBTC: {
    symbol: 'BTCUSDT',
    side: 'LONG',
    entryPrice: 50000,
    marginUsdt: 100,
    leverage: 2,
    stopLossPct: 2,
    takeProfitPct: 5
  } as PaperOrderPayload,

  shortETH: {
    symbol: 'ETHUSDT',
    side: 'SHORT',
    entryPrice: 3000,
    marginUsdt: 50,
    leverage: 3,
    stopLossPct: 3,
    takeProfitPct: 6
  } as PaperOrderPayload,

  highLeverage: {
    symbol: 'BTCUSDT',
    side: 'LONG',
    entryPrice: 50000,
    marginUsdt: 200,
    leverage: 10,
    stopLossPct: 1,
    takeProfitPct: 3
  } as PaperOrderPayload
};

/**
 * Backtest fixtures
 */
export const backtests = {
  simple: {
    name: 'Simple RSI Strategy',
    description: 'Basic RSI oversold/overbought strategy',
    symbol: 'BTCUSDT',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    initialCapital: 10000,
    strategy: {
      type: 'RSI',
      params: {
        period: 14,
        oversold: 30,
        overbought: 70
      }
    }
  } as CreateBacktestRequest,

  macd: {
    name: 'MACD Crossover',
    description: 'MACD signal line crossover strategy',
    symbol: 'ETHUSDT',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    initialCapital: 5000,
    strategy: {
      type: 'MACD',
      params: {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9
      }
    }
  } as CreateBacktestRequest,

  multiIndicator: {
    name: 'Multi-Indicator Strategy',
    description: 'Combines RSI, MACD, and moving averages',
    symbol: 'BTCUSDT',
    startDate: '2024-06-01',
    endDate: '2024-12-31',
    initialCapital: 20000,
    strategy: {
      type: 'MULTI',
      params: {
        indicators: ['RSI', 'MACD', 'SMA'],
        rsiPeriod: 14,
        smaPeriod: 50
      }
    }
  } as CreateBacktestRequest
};

/**
 * Market tick fixtures
 */
export const marketTicks = {
  btc: {
    symbol: 'BTCUSDT',
    price: 50000,
    change24hPct: 2.5,
    volume24h: 1000000000,
    source: 'binance'
  },

  eth: {
    symbol: 'ETHUSDT',
    price: 3000,
    change24hPct: -1.2,
    volume24h: 500000000,
    source: 'binance'
  }
};

/**
 * Trading signal fixtures
 */
export const tradingSignals = {
  longBTC: {
    symbol: 'BTCUSDT',
    direction: 'LONG',
    confidence: 0.85,
    rationale: 'RSI oversold, MACD bullish crossover',
    indicators: {
      rsi: 28,
      macd: 'bullish',
      sma50: 'above',
      volume: 'increasing'
    }
  },

  shortETH: {
    symbol: 'ETHUSDT',
    direction: 'SHORT',
    confidence: 0.72,
    rationale: 'RSI overbought, bearish divergence',
    indicators: {
      rsi: 75,
      macd: 'bearish',
      sma50: 'below',
      volume: 'decreasing'
    }
  }
};

/**
 * Position fixtures
 */
export const positions = {
  openLong: {
    symbol: 'BTCUSDT',
    side: 'LONG',
    status: 'OPEN',
    entryPrice: 50000,
    currentPrice: 51000,
    marginUsdt: 100,
    leverage: 2,
    pnlUsdt: 20,
    pnlPct: 2.0
  },

  openShort: {
    symbol: 'ETHUSDT',
    side: 'SHORT',
    status: 'OPEN',
    entryPrice: 3000,
    currentPrice: 2950,
    marginUsdt: 50,
    leverage: 3,
    pnlUsdt: 7.5,
    pnlPct: 1.67
  },

  closedProfit: {
    symbol: 'BTCUSDT',
    side: 'LONG',
    status: 'CLOSED',
    entryPrice: 48000,
    exitPrice: 50000,
    marginUsdt: 100,
    leverage: 2,
    pnlUsdt: 41.67,
    pnlPct: 4.17
  },

  closedLoss: {
    symbol: 'ETHUSDT',
    side: 'SHORT',
    status: 'CLOSED',
    entryPrice: 3000,
    exitPrice: 3100,
    marginUsdt: 50,
    leverage: 3,
    pnlUsdt: -15,
    pnlPct: -3.33
  }
};

/**
 * Alert fixtures
 */
export const alerts = {
  whaleAlert: {
    type: 'WHALE',
    title: 'Large BTC Transfer Detected',
    message: '1000 BTC moved to exchange',
    status: 'OPEN',
    severity: 'HIGH'
  },

  priceAlert: {
    type: 'PRICE',
    title: 'BTC Price Alert',
    message: 'BTC crossed $50,000',
    status: 'OPEN',
    severity: 'MEDIUM'
  },

  riskAlert: {
    type: 'RISK',
    title: 'High Leverage Warning',
    message: 'Position leverage exceeds recommended limit',
    status: 'OPEN',
    severity: 'HIGH'
  }
};

/**
 * Sentiment snapshot fixtures
 */
export const sentimentSnapshots = {
  bullish: {
    score: 75,
    label: 'Bullish',
    source: 'fear-greed-index',
    timestamp: new Date().toISOString()
  },

  bearish: {
    score: 25,
    label: 'Bearish',
    source: 'fear-greed-index',
    timestamp: new Date().toISOString()
  },

  neutral: {
    score: 50,
    label: 'Neutral',
    source: 'fear-greed-index',
    timestamp: new Date().toISOString()
  }
};

/**
 * Whale event fixtures
 */
export const whaleEvents = {
  largeTransfer: {
    type: 'LARGE_TRANSFER',
    valueUsd: 50000000,
    asset: 'BTC',
    from: 'unknown',
    to: 'binance',
    timestamp: new Date().toISOString()
  },

  exchangeInflow: {
    type: 'EXCHANGE_INFLOW',
    valueUsd: 25000000,
    asset: 'ETH',
    exchange: 'coinbase',
    timestamp: new Date().toISOString()
  },

  exchangeOutflow: {
    type: 'EXCHANGE_OUTFLOW',
    valueUsd: 30000000,
    asset: 'BTC',
    exchange: 'binance',
    timestamp: new Date().toISOString()
  }
};

/**
 * Performance metrics fixtures
 */
export const performanceMetrics = {
  profitable: {
    totalReturn: 1500,
    totalReturnPct: 15,
    sharpeRatio: 1.8,
    maxDrawdown: -500,
    maxDrawdownPct: -5,
    winRate: 0.65,
    totalTrades: 50
  },

  breakeven: {
    totalReturn: 0,
    totalReturnPct: 0,
    sharpeRatio: 0,
    maxDrawdown: -1000,
    maxDrawdownPct: -10,
    winRate: 0.5,
    totalTrades: 30
  },

  losing: {
    totalReturn: -800,
    totalReturnPct: -8,
    sharpeRatio: -0.5,
    maxDrawdown: -1200,
    maxDrawdownPct: -12,
    winRate: 0.35,
    totalTrades: 40
  }
};
