import { MarketTick, Candle } from '../types';

export interface CandleAggregatorConfig {
  intervals: string[];
  flushInterval?: number;
}

export class CandleAggregator {
  private candles: Map<string, Map<string, Candle>> = new Map();
  private config: CandleAggregatorConfig;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config: CandleAggregatorConfig) {
    this.config = {
      intervals: config.intervals || ['1m', '5m', '15m', '1h', '4h', '1d'],
      flushInterval: config.flushInterval || 60000, // 1 minute
    };
  }

  start(): void {
    if (this.config.flushInterval) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  processTick(tick: MarketTick): Candle[] {
    const updatedCandles: Candle[] = [];

    for (const interval of this.config.intervals) {
      const candle = this.updateCandle(tick, interval);
      if (candle) {
        updatedCandles.push(candle);
      }
    }

    return updatedCandles;
  }

  private updateCandle(tick: MarketTick, interval: string): Candle | null {
    const key = `${tick.symbol}:${interval}`;
    const timestamp = this.getCandleTimestamp(tick.timestamp, interval);

    if (!this.candles.has(key)) {
      this.candles.set(key, new Map());
    }

    const symbolCandles = this.candles.get(key)!;
    const timestampKey = timestamp.getTime().toString();

    let candle = symbolCandles.get(timestampKey);

    if (!candle) {
      // Create new candle
      candle = {
        symbol: tick.symbol,
        interval,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume,
        timestamp,
      };
      symbolCandles.set(timestampKey, candle);
    } else {
      // Update existing candle
      candle.high = Math.max(candle.high, tick.price);
      candle.low = Math.min(candle.low, tick.price);
      candle.close = tick.price;
      candle.volume += tick.volume;
    }

    return candle;
  }

  private getCandleTimestamp(timestamp: Date, interval: string): Date {
    const time = timestamp.getTime();
    const intervalMs = this.getIntervalMs(interval);
    const candleTime = Math.floor(time / intervalMs) * intervalMs;
    return new Date(candleTime);
  }

  private getIntervalMs(interval: string): number {
    const map: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return map[interval] || 60 * 1000;
  }

  getCandle(symbol: string, interval: string, timestamp?: Date): Candle | null {
    const key = `${symbol}:${interval}`;
    const symbolCandles = this.candles.get(key);

    if (!symbolCandles) {
      return null;
    }

    if (timestamp) {
      const candleTimestamp = this.getCandleTimestamp(timestamp, interval);
      return symbolCandles.get(candleTimestamp.getTime().toString()) || null;
    }

    // Return latest candle
    const candles = Array.from(symbolCandles.values());
    return candles[candles.length - 1] || null;
  }

  getCandles(symbol: string, interval: string, limit: number = 100): Candle[] {
    const key = `${symbol}:${interval}`;
    const symbolCandles = this.candles.get(key);

    if (!symbolCandles) {
      return [];
    }

    const candles = Array.from(symbolCandles.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return candles;
  }

  private flush(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, symbolCandles] of this.candles.entries()) {
      for (const [timestampKey, candle] of symbolCandles.entries()) {
        if (now - candle.timestamp.getTime() > maxAge) {
          symbolCandles.delete(timestampKey);
        }
      }

      if (symbolCandles.size === 0) {
        this.candles.delete(key);
      }
    }
  }

  clear(): void {
    this.candles.clear();
  }
}
