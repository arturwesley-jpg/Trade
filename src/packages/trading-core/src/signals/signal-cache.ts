/**
 * Signal Cache Manager
 *
 * Manages caching of trading signals with TTL and invalidation strategies.
 */

import type { CacheClient } from '@trade/shared';
import type { TradingSignal, SignalHistory } from './signal-types.js';

export interface SignalCacheConfig {
  cache: CacheClient;
  signalTTL?: number; // seconds, default 300 (5 minutes)
  historyTTL?: number; // seconds, default 3600 (1 hour)
}

export class SignalCache {
  private cache: CacheClient;
  private signalTTL: number;
  private historyTTL: number;

  constructor(config: SignalCacheConfig) {
    this.cache = config.cache;
    this.signalTTL = config.signalTTL ?? 300; // 5 minutes
    this.historyTTL = config.historyTTL ?? 3600; // 1 hour
  }

  /**
   * Get cached signal for a symbol
   */
  async getSignal(symbol: string): Promise<TradingSignal | null> {
    const key = this.getSignalKey(symbol);
    return await this.cache.get<TradingSignal>(key);
  }

  /**
   * Cache a signal
   */
  async setSignal(signal: TradingSignal): Promise<void> {
    const key = this.getSignalKey(signal.symbol);
    await this.cache.set(key, signal, this.signalTTL);
  }

  /**
   * Get cached signals for multiple symbols
   */
  async getSignalsBatch(symbols: string[]): Promise<Map<string, TradingSignal | null>> {
    const keys = symbols.map(s => this.getSignalKey(s));
    const values = await this.cache.mget<TradingSignal>(keys);

    const results = new Map<string, TradingSignal | null>();
    symbols.forEach((symbol, i) => {
      results.set(symbol, values[i]);
    });

    return results;
  }

  /**
   * Cache multiple signals
   */
  async setSignalsBatch(signals: TradingSignal[]): Promise<void> {
    const entries = signals.map(signal => ({
      key: this.getSignalKey(signal.symbol),
      value: signal,
      ttl: this.signalTTL,
    }));

    await this.cache.mset(entries);
  }

  /**
   * Get signal history for a symbol
   */
  async getHistory(symbol: string): Promise<SignalHistory | null> {
    const key = this.getHistoryKey(symbol);
    return await this.cache.get<SignalHistory>(key);
  }

  /**
   * Cache signal history
   */
  async setHistory(symbol: string, history: SignalHistory): Promise<void> {
    const key = this.getHistoryKey(symbol);
    await this.cache.set(key, history, this.historyTTL);
  }

  /**
   * Add signal to history cache
   */
  async appendToHistory(signal: TradingSignal): Promise<void> {
    const history = await this.getHistory(signal.symbol);

    if (history) {
      // Add new signal and keep last 100
      history.signals.push(signal);
      if (history.signals.length > 100) {
        history.signals = history.signals.slice(-100);
      }

      // Recalculate performance if available
      if (history.performance) {
        history.performance = this.calculatePerformance(history.signals);
      }

      await this.setHistory(signal.symbol, history);
    } else {
      // Create new history
      await this.setHistory(signal.symbol, {
        signals: [signal],
      });
    }
  }

  /**
   * Get all active signals
   */
  async getActiveSignals(): Promise<TradingSignal[]> {
    const pattern = 'signal:*';
    const keys = await this.cache.keys(pattern);

    if (keys.length === 0) {
      return [];
    }

    const values = await this.cache.mget<TradingSignal>(keys);
    return values.filter((v): v is TradingSignal => v !== null);
  }

  /**
   * Invalidate signal cache for a symbol
   */
  async invalidateSignal(symbol: string): Promise<void> {
    const key = this.getSignalKey(symbol);
    await this.cache.del(key);
  }

  /**
   * Invalidate all signal caches
   */
  async invalidateAllSignals(): Promise<void> {
    await this.cache.clear('signal:*');
  }

  /**
   * Check if signal is cached
   */
  async hasSignal(symbol: string): Promise<boolean> {
    const key = this.getSignalKey(symbol);
    return await this.cache.exists(key);
  }

  /**
   * Get TTL for cached signal
   */
  async getSignalTTL(symbol: string): Promise<number> {
    const key = this.getSignalKey(symbol);
    return await this.cache.ttl(key);
  }

  /**
   * Calculate performance metrics from signal history
   */
  private calculatePerformance(signals: TradingSignal[]): SignalHistory['performance'] {
    // Filter signals with entry and exit prices
    const completedSignals = signals.filter(
      s => s.entryPrice && s.takeProfit && s.stopLoss
    );

    if (completedSignals.length === 0) {
      return undefined;
    }

    let profitable = 0;
    let unprofitable = 0;
    let totalReturn = 0;

    for (const signal of completedSignals) {
      // This is a simplified calculation
      // In production, you'd track actual exit prices
      const expectedReturn =
        signal.type === 'buy'
          ? ((signal.takeProfit! - signal.entryPrice!) / signal.entryPrice!) * 100
          : ((signal.entryPrice! - signal.takeProfit!) / signal.entryPrice!) * 100;

      if (expectedReturn > 0) {
        profitable++;
        totalReturn += expectedReturn;
      } else {
        unprofitable++;
        totalReturn += expectedReturn;
      }
    }

    return {
      totalSignals: completedSignals.length,
      profitable,
      unprofitable,
      winRate: (profitable / completedSignals.length) * 100,
      avgReturn: totalReturn / completedSignals.length,
    };
  }

  /**
   * Generate cache key for signal
   */
  private getSignalKey(symbol: string): string {
    return `signal:${symbol.toLowerCase()}`;
  }

  /**
   * Generate cache key for history
   */
  private getHistoryKey(symbol: string): string {
    return `signal:history:${symbol.toLowerCase()}`;
  }
}
