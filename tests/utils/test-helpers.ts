import type { Candle } from '@trade/shared';

/**
 * Generate mock candle data for testing
 */
export function generateMockCandles(
  count: number,
  options: {
    symbol?: string;
    basePrice?: number;
    pattern?: 'uptrend' | 'downtrend' | 'sideways' | 'volatile';
    startTime?: Date;
    interval?: number; // milliseconds
  } = {}
): Candle[] {
  const {
    symbol = 'BTC-USDT',
    basePrice = 50000,
    pattern = 'sideways',
    startTime = new Date(Date.now() - count * 60000),
    interval = 60000, // 1 minute
  } = options;

  const candles: Candle[] = [];
  let currentPrice = basePrice;

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(startTime.getTime() + i * interval);

    // Apply pattern
    if (pattern === 'uptrend') {
      currentPrice += (Math.random() * 100) + 50;
    } else if (pattern === 'downtrend') {
      currentPrice -= (Math.random() * 100) + 50;
    } else if (pattern === 'volatile') {
      currentPrice += (Math.random() - 0.5) * 500;
    } else {
      currentPrice += (Math.random() - 0.5) * 100;
    }

    const volatility = currentPrice * 0.01;
    const open = currentPrice + (Math.random() - 0.5) * volatility;
    const close = currentPrice + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    const volume = 1000 + Math.random() * 500;

    candles.push({
      symbol,
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return candles;
}

/**
 * Generate mock signal data
 */
export function generateMockSignal(overrides: any = {}) {
  return {
    id: Math.floor(Math.random() * 10000),
    symbol: 'BTC-USDT',
    signal: 'BUY',
    confidence: 75,
    strength: 80,
    timestamp: new Date(),
    indicators: {
      rsi: { value: 45, signal: 'BUY', weight: 1.0 },
      macd: { value: 0.5, signal: 'BUY', weight: 1.0 },
      bollinger: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
      stochastic: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
      obv: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
      adx: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
      atr: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
      supportResistance: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
    },
    explanation: 'Strong buy signal detected',
    ...overrides,
  };
}

/**
 * Generate mock trade data
 */
export function generateMockTrade(overrides: any = {}) {
  return {
    id: Math.floor(Math.random() * 10000),
    userId: 'test-user-id',
    symbol: 'BTC-USDT',
    side: 'BUY',
    type: 'MARKET',
    quantity: 0.1,
    price: 50000,
    status: 'FILLED',
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Generate mock order book data
 */
export function generateMockOrderBook(symbol: string = 'BTC-USDT', depth: number = 20) {
  const basePrice = 50000;
  const bids: [number, number][] = [];
  const asks: [number, number][] = [];

  for (let i = 0; i < depth; i++) {
    const bidPrice = basePrice - (i + 1) * 10;
    const askPrice = basePrice + (i + 1) * 10;
    const quantity = Math.random() * 5;

    bids.push([bidPrice, quantity]);
    asks.push([askPrice, quantity]);
  }

  return {
    symbol,
    bids,
    asks,
    timestamp: new Date(),
  };
}

/**
 * Generate mock sentiment data
 */
export function generateMockSentiment(overrides: any = {}) {
  return {
    symbol: 'BTC-USDT',
    overallScore: 0.6,
    sentiment: 'BULLISH',
    confidence: 75,
    timestamp: new Date(),
    components: {
      news: { score: 0.7, count: 10, weight: 1.0 },
      fearGreed: { score: 0.65, weight: 1.0 },
      social: { score: 0.5, volume: 1000, weight: 1.0 },
      whales: { score: 0.6, activity: 5, weight: 1.0 },
    },
    ...overrides,
  };
}

/**
 * Generate mock portfolio data
 */
export function generateMockPortfolio(overrides: any = {}) {
  return {
    userId: 'test-user-id',
    totalValue: 10000,
    availableBalance: 5000,
    positions: [
      {
        symbol: 'BTC-USDT',
        quantity: 0.1,
        averagePrice: 45000,
        currentPrice: 50000,
        unrealizedPnL: 500,
        unrealizedPnLPercent: 11.11,
      },
    ],
    performance: {
      totalPnL: 1000,
      totalPnLPercent: 10,
      winRate: 65,
      totalTrades: 20,
      winningTrades: 13,
      losingTrades: 7,
    },
    ...overrides,
  };
}

/**
 * Generate mock alert data
 */
export function generateMockAlert(overrides: any = {}) {
  return {
    id: Math.floor(Math.random() * 10000),
    userId: 'test-user-id',
    symbol: 'BTC-USDT',
    type: 'PRICE',
    condition: 'ABOVE',
    value: 55000,
    active: true,
    triggered: false,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random string
 */
export function randomString(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random email
 */
export function randomEmail(): string {
  return `test-${randomString(8)}@example.com`;
}

/**
 * Clean up test data from database
 */
export async function cleanupTestData(db: any, userId?: string) {
  if (userId) {
    await db('alerts').where('user_id', userId).del();
    await db('trades').where('user_id', userId).del();
    await db('positions').where('user_id', userId).del();
    await db('users').where('id', userId).del();
  }
}
