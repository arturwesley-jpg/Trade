/**
 * Signal Service
 *
 * Orchestrates signal generation, persistence, and retrieval.
 * Integrates indicator aggregation with database storage.
 */

import type { Candle } from '@trade/market-data';
import type { Signal } from '@trade/database';
import { PostgresSignalRepository } from '@trade/database';
import { SignalAggregator, type AggregatedSignal } from './signal-aggregator.js';
import { SignalExplanationGenerator, type SignalExplanation } from './signal-explanation.js';

export interface SignalWithExplanation extends Signal {
  explanation: SignalExplanation;
}

export interface SignalServiceConfig {
  signalRepository: PostgresSignalRepository;
  aggregatorConfig?: ConstructorParameters<typeof SignalAggregator>[0];
}

export class SignalService {
  private signalRepository: PostgresSignalRepository;
  private aggregator: SignalAggregator;
  private explanationGenerator: SignalExplanationGenerator;

  constructor(config: SignalServiceConfig) {
    this.signalRepository = config.signalRepository;
    this.aggregator = new SignalAggregator(config.aggregatorConfig);
    this.explanationGenerator = new SignalExplanationGenerator();
  }

  /**
   * Generate and persist a new signal
   */
  async generateSignal(candles: Candle[]): Promise<SignalWithExplanation | null> {
    // Aggregate indicators
    const aggregated = this.aggregator.aggregate(candles);
    if (!aggregated) {
      return null;
    }

    // Generate explanation
    const explanation = this.explanationGenerator.generate(aggregated);

    // Map to database signal format
    const signalData: Omit<Signal, 'id'> = {
      symbol: aggregated.symbol,
      type: (aggregated.signal === 'BUY' ? 'BUY' : aggregated.signal === 'SELL' ? 'SELL' : 'NEUTRAL') as 'BUY' | 'SELL' | 'NEUTRAL',
      confidence: aggregated.confidence / 100, // Convert to 0-1 scale
      score: aggregated.strength / 100,
      rationale: {
        explanation: explanation.summary,
        reasoning: explanation.reasoning,
        risks: explanation.risks,
        recommendations: explanation.recommendations,
      },
      indicators: {
        rsi: aggregated.indicators.rsi,
        macd: aggregated.indicators.macd,
        bollinger: aggregated.indicators.bollinger,
        stochastic: aggregated.indicators.stochastic,
        obv: aggregated.indicators.obv,
        adx: aggregated.indicators.adx,
        atr: aggregated.indicators.atr,
        supportResistance: aggregated.indicators.supportResistance,
      },
      sentimentScore: 0,
      whaleImpact: 0,
      shouldExecute: aggregated.confidence >= 70,
      timestamp: new Date(),
    };

    // Persist to database
    const signal = await this.signalRepository.create(signalData);

    return {
      ...signal,
      explanation,
    };
  }

  /**
   * Get recent signals for a symbol
   */
  async getRecentSignals(
    symbol: string,
    limit: number = 10
  ): Promise<Signal[]> {
    return this.signalRepository.findBySymbol(symbol, limit);
  }

  /**
   * Get signal by ID with explanation
   */
  async getSignalWithExplanation(id: string): Promise<SignalWithExplanation | null> {
    const signal = await this.signalRepository.findById(id);
    if (!signal) {
      return null;
    }

    // Reconstruct aggregated signal for explanation generation
    const aggregated: AggregatedSignal = {
      symbol: signal.symbol,
      signal: signal.type as 'BUY' | 'SELL' | 'NEUTRAL',
      confidence: signal.confidence * 100,
      strength: signal.score * 100,
      indicators: signal.indicators as any,
      explanation: typeof signal.rationale === 'object' && signal.rationale !== null
        ? (signal.rationale as any).explanation || ''
        : String(signal.rationale || ''),
      timestamp: signal.timestamp,
    };

    const explanation = this.explanationGenerator.generate(aggregated);

    return {
      ...signal,
      explanation,
    };
  }

  /**
   * Get active signals (not expired)
   */
  async getActiveSignals(symbol?: string): Promise<Signal[]> {
    return this.signalRepository.findActive(symbol);
  }

  /**
   * Mark signal as executed
   */
  async markSignalExecuted(id: string): Promise<void> {
    await this.signalRepository.update(id, { shouldExecute: false });
  }

  /**
   * Mark signal as expired
   */
  async markSignalExpired(id: string): Promise<void> {
    await this.signalRepository.update(id, { shouldExecute: false });
  }

  /**
   * Get signal statistics
   */
  async getSignalStats(symbol: string, days: number = 30): Promise<{
    total: number;
    byType: { LONG: number; SHORT: number; NEUTRAL: number };
    avgConfidence: number;
    executed: number;
    expired: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const signals = await this.signalRepository.findByTimeRange(
      startDate,
      new Date()
    );

    // Filter by symbol if provided
    const filteredSignals = symbol
      ? signals.filter((s: Signal) => s.symbol === symbol)
      : signals;

    const stats = {
      total: filteredSignals.length,
      byType: {
        LONG: filteredSignals.filter((s: Signal) => s.type === 'BUY').length,
        SHORT: filteredSignals.filter((s: Signal) => s.type === 'SELL').length,
        NEUTRAL: filteredSignals.filter((s: Signal) => s.type === 'NEUTRAL').length,
      },
      avgConfidence: filteredSignals.reduce((sum: number, s: Signal) => sum + s.confidence, 0) / filteredSignals.length || 0,
      executed: filteredSignals.filter((s: Signal) => !s.shouldExecute).length,
      expired: 0, // No longer tracking expired status
    };

    return stats;
  }

  /**
   * Batch generate signals for multiple symbols
   */
  async generateSignalsBatch(
    candlesBySymbol: Map<string, Candle[]>
  ): Promise<Map<string, SignalWithExplanation | null>> {
    const results = new Map<string, SignalWithExplanation | null>();

    for (const [symbol, candles] of candlesBySymbol.entries()) {
      try {
        const signal = await this.generateSignal(candles);
        results.set(symbol, signal);
      } catch (error) {
        console.error(`Error generating signal for ${symbol}:`, error);
        results.set(symbol, null);
      }
    }

    return results;
  }
}
