/**
 * Enhanced Signal Service
 *
 * Orchestrates signal generation with caching, persistence, and real-time updates.
 */

import type { Candle } from '@trade/market-data';
import type { Signal as DBSignal } from '@trade/database';
import { PostgresSignalRepository } from '@trade/database';
import type { AggregatedSentiment } from '@trade/shared';
import { CacheClient } from '@trade/shared';
import { EnhancedSignalGenerator, type EnhancedSignalGeneratorConfig } from './enhanced-signal-generator.js';
import { SignalCache, type SignalCacheConfig } from './signal-cache.js';
import type { TradingSignal, SignalHistory, SignalGenerationOptions } from './signal-types.js';

export interface SentimentService {
  getSentiment(symbol: string): Promise<AggregatedSentiment>;
  getSentimentBatch(symbols: string[]): Promise<Map<string, AggregatedSentiment>>;
}

export interface EnhancedSignalServiceConfig {
  signalRepository: PostgresSignalRepository;
  sentimentService?: SentimentService;
  cache?: CacheClient;
  generatorConfig?: EnhancedSignalGeneratorConfig;
  cacheConfig?: Omit<SignalCacheConfig, 'cache'>;
}

export class EnhancedSignalService {
  private signalRepository: PostgresSignalRepository;
  private sentimentService?: SentimentService;
  private generator: EnhancedSignalGenerator;
  private cache?: SignalCache;

  constructor(config: EnhancedSignalServiceConfig) {
    this.signalRepository = config.signalRepository;
    this.sentimentService = config.sentimentService;
    this.generator = new EnhancedSignalGenerator(config.generatorConfig);

    if (config.cache) {
      this.cache = new SignalCache({
        cache: config.cache,
        ...config.cacheConfig,
      });
    }
  }

  /**
   * Generate and persist a new signal
   */
  async generateSignal(
    candles: Candle[],
    options?: SignalGenerationOptions
  ): Promise<TradingSignal | null> {
    const symbol = options?.symbol || candles[0]?.symbol;
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    // Check cache first
    if (this.cache) {
      const cached = await this.cache.getSignal(symbol);
      if (cached) {
        return cached;
      }
    }

    // Get sentiment data if service is available
    let sentiment: AggregatedSentiment | undefined;
    if (this.sentimentService) {
      try {
        sentiment = await this.sentimentService.getSentiment(symbol);
      } catch (error) {
        console.error(`Failed to get sentiment for ${symbol}:`, error);
      }
    }

    // Generate signal
    const signal = await this.generator.generate(candles, sentiment, options);
    if (!signal) {
      return null;
    }

    // Persist to database
    try {
      await this.persistSignal(signal);
    } catch (error) {
      console.error(`Failed to persist signal for ${symbol}:`, error);
    }

    // Cache the signal
    if (this.cache) {
      await this.cache.setSignal(signal);
      await this.cache.appendToHistory(signal);
    }

    return signal;
  }

  /**
   * Generate signals for multiple symbols
   */
  async generateSignalsBatch(
    candlesBySymbol: Map<string, Candle[]>,
    options?: Omit<SignalGenerationOptions, 'symbol'>
  ): Promise<Map<string, TradingSignal | null>> {
    const symbols = Array.from(candlesBySymbol.keys());

    // Check cache for existing signals
    const cachedSignals = this.cache
      ? await this.cache.getSignalsBatch(symbols)
      : new Map<string, TradingSignal | null>();

    // Identify symbols that need new signals
    const symbolsToGenerate = symbols.filter(
      symbol => !cachedSignals.get(symbol)
    );

    if (symbolsToGenerate.length === 0) {
      return cachedSignals;
    }

    // Get sentiment data for all symbols if service is available
    let sentimentBySymbol: Map<string, AggregatedSentiment> | undefined;
    if (this.sentimentService) {
      try {
        sentimentBySymbol = await this.sentimentService.getSentimentBatch(
          symbolsToGenerate
        );
      } catch (error) {
        console.error('Failed to get sentiment batch:', error);
      }
    }

    // Generate new signals
    const candlesToGenerate = new Map<string, Candle[]>();
    for (const symbol of symbolsToGenerate) {
      const candles = candlesBySymbol.get(symbol);
      if (candles) {
        candlesToGenerate.set(symbol, candles);
      }
    }

    const newSignals = await this.generator.generateBatch(
      candlesToGenerate,
      sentimentBySymbol,
      options
    );

    // Persist and cache new signals
    const signalsToPersist: TradingSignal[] = [];
    for (const [symbol, signal] of newSignals.entries()) {
      if (signal) {
        signalsToPersist.push(signal);
        cachedSignals.set(symbol, signal);
      }
    }

    if (signalsToPersist.length > 0) {
      try {
        await Promise.all(
          signalsToPersist.map(signal => this.persistSignal(signal))
        );
      } catch (error) {
        console.error('Failed to persist signals batch:', error);
      }

      if (this.cache) {
        await this.cache.setSignalsBatch(signalsToPersist);
        await Promise.all(
          signalsToPersist.map(signal => this.cache!.appendToHistory(signal))
        );
      }
    }

    return cachedSignals;
  }

  /**
   * Get latest signal for a symbol
   */
  async getLatestSignal(symbol: string): Promise<TradingSignal | null> {
    // Check cache first
    if (this.cache) {
      const cached = await this.cache.getSignal(symbol);
      if (cached) {
        return cached;
      }
    }

    // Fallback to database
    const dbSignals = await this.signalRepository.findBySymbol(symbol, 1);
    if (dbSignals.length === 0) {
      return null;
    }

    return this.mapDBSignalToTradingSignal(dbSignals[0]);
  }

  /**
   * Get signal history for a symbol
   */
  async getSignalHistory(
    symbol: string,
    limit: number = 50
  ): Promise<SignalHistory> {
    // Check cache first
    if (this.cache) {
      const cached = await this.cache.getHistory(symbol);
      if (cached) {
        return cached;
      }
    }

    // Fallback to database
    const dbSignals = await this.signalRepository.findBySymbol(symbol, limit);
    const signals = dbSignals.map((s: DBSignal) => this.mapDBSignalToTradingSignal(s));

    const history: SignalHistory = {
      signals,
    };

    // Cache the history
    if (this.cache) {
      await this.cache.setHistory(symbol, history);
    }

    return history;
  }

  /**
   * Get all active signals
   */
  async getActiveSignals(symbol?: string): Promise<TradingSignal[]> {
    // Try cache first
    if (this.cache && !symbol) {
      const cached = await this.cache.getActiveSignals();
      if (cached.length > 0) {
        return cached;
      }
    }

    // Fallback to database
    const dbSignals = await this.signalRepository.findActive(symbol);
    return dbSignals.map((s: DBSignal) => this.mapDBSignalToTradingSignal(s));
  }

  /**
   * Get recent signals
   */
  async getRecentSignals(
    symbol: string,
    limit: number = 20
  ): Promise<TradingSignal[]> {
    const dbSignals = await this.signalRepository.findBySymbol(symbol, limit);
    return dbSignals.map((s: DBSignal) => this.mapDBSignalToTradingSignal(s));
  }

  /**
   * Invalidate cached signal
   */
  async invalidateSignal(symbol: string): Promise<void> {
    if (this.cache) {
      await this.cache.invalidateSignal(symbol);
    }
  }

  /**
   * Persist signal to database
   */
  private async persistSignal(signal: TradingSignal): Promise<void> {
    const dbSignal: Omit<DBSignal, 'id'> = {
      symbol: signal.symbol,
      type: signal.type.toUpperCase() as 'BUY' | 'SELL' | 'NEUTRAL',
      confidence: signal.confidence / 100, // Convert to 0-1
      score: signal.confidence,
      rationale: signal.reasoning,
      indicators: signal.indicators as any,
      sentimentScore: signal.sentiment?.score ?? undefined,
      whaleImpact: signal.sentiment?.components?.whales ?? undefined,
      shouldExecute: signal.type !== 'hold' && signal.confidence >= 70,
      timestamp: new Date(signal.timestamp),
    };

    await this.signalRepository.create(dbSignal);
  }

  /**
   * Map database signal to trading signal
   */
  private mapDBSignalToTradingSignal(dbSignal: DBSignal): TradingSignal {
    return {
      symbol: dbSignal.symbol,
      type: dbSignal.type.toLowerCase() as 'buy' | 'sell' | 'hold',
      strength: this.mapConfidenceToStrength(dbSignal.confidence * 100),
      confidence: Math.round(dbSignal.confidence * 100),
      price: 0, // Not stored in DB
      indicators: dbSignal.indicators as any,
      sentiment: dbSignal.sentimentScore
        ? {
            score: dbSignal.sentimentScore,
            classification: this.mapSentimentScore(dbSignal.sentimentScore),
            confidence: 0,
          }
        : undefined,
      reasoning: Array.isArray(dbSignal.rationale)
        ? dbSignal.rationale
        : [dbSignal.rationale],
      timestamp: dbSignal.timestamp.getTime(),
    };
  }

  /**
   * Map confidence to strength
   */
  private mapConfidenceToStrength(confidence: number): 'strong' | 'moderate' | 'weak' {
    if (confidence >= 75) return 'strong';
    if (confidence >= 55) return 'moderate';
    return 'weak';
  }

  /**
   * Map sentiment score to classification
   */
  private mapSentimentScore(score: number): string {
    if (score <= -0.6) return 'VERY_BEARISH';
    if (score <= -0.2) return 'BEARISH';
    if (score <= 0.2) return 'NEUTRAL';
    if (score <= 0.6) return 'BULLISH';
    return 'VERY_BULLISH';
  }
}
