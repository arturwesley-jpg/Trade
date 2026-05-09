/**
 * Enhanced Signal Generator
 *
 * Combines technical indicators with sentiment analysis to generate
 * comprehensive trading signals with confidence scoring and risk management.
 */

import type { Candle } from '@trade/market-data';
import type { AggregatedSentiment } from '@trade/shared';
import {
  RSICalculator,
  MACDCalculator,
  BollingerBandsCalculator,
  StochasticCalculator,
  OBVCalculator,
  ADXCalculator,
  ATRCalculator,
  SupportResistanceDetector,
  type AggregatedSignal,
} from '../indicators';
import { SignalAggregator } from '../indicators/signal-aggregator';
import type {
  TradingSignal,
  SignalType,
  SignalStrength,
  SignalGenerationOptions,
  IndicatorSignal,
} from './signal-types';

export interface EnhancedSignalGeneratorConfig {
  sentimentWeight?: number; // 0-1, default 0.3
  technicalWeight?: number; // 0-1, default 0.7
  minConfidence?: number; // 0-100, default 60
  riskRewardRatio?: number; // default 2.0
  aggregatorConfig?: ConstructorParameters<typeof SignalAggregator>[0];
}

export class EnhancedSignalGenerator {
  private signalAggregator: SignalAggregator;
  private sentimentWeight: number;
  private technicalWeight: number;
  private minConfidence: number;
  private riskRewardRatio: number;

  constructor(config: EnhancedSignalGeneratorConfig = {}) {
    this.signalAggregator = new SignalAggregator(config.aggregatorConfig);
    this.sentimentWeight = config.sentimentWeight ?? 0.3;
    this.technicalWeight = config.technicalWeight ?? 0.7;
    this.minConfidence = config.minConfidence ?? 60;
    this.riskRewardRatio = config.riskRewardRatio ?? 2.0;

    // Ensure weights sum to 1
    const totalWeight = this.sentimentWeight + this.technicalWeight;
    this.sentimentWeight = this.sentimentWeight / totalWeight;
    this.technicalWeight = this.technicalWeight / totalWeight;
  }

  /**
   * Generate a comprehensive trading signal
   */
  async generate(
    candles: Candle[],
    sentiment?: AggregatedSentiment,
    options?: SignalGenerationOptions
  ): Promise<TradingSignal | null> {
    if (candles.length < 50) {
      return null;
    }

    const symbol = options?.symbol || candles[0].symbol;
    const currentPrice = candles[candles.length - 1].close;

    // Get technical signal
    const technicalSignal = this.signalAggregator.aggregate(candles);
    if (!technicalSignal) {
      return null;
    }

    // Calculate combined confidence
    const technicalConfidence = technicalSignal.confidence;
    const sentimentConfidence = sentiment?.confidence ?? 0;

    // Combine technical and sentiment scores
    const technicalScore = this.mapSignalToScore(technicalSignal.signal);
    const sentimentScore = sentiment?.overallScore ?? 0;

    const combinedScore =
      technicalScore * this.technicalWeight +
      sentimentScore * this.sentimentWeight;

    const combinedConfidence =
      technicalConfidence * this.technicalWeight +
      sentimentConfidence * this.sentimentWeight;

    // Determine final signal type
    const signalType = this.determineSignalType(combinedScore, combinedConfidence);
    const signalStrength = this.determineSignalStrength(
      combinedConfidence,
      technicalSignal.strength
    );

    // Calculate risk levels if requested
    let entryPrice: number | undefined;
    let stopLoss: number | undefined;
    let takeProfit: number | undefined;
    let riskReward: number | undefined;

    if (options?.includeRiskLevels && signalType !== 'hold') {
      const riskLevels = this.calculateRiskLevels(
        currentPrice,
        signalType,
        candles,
        technicalSignal
      );
      entryPrice = riskLevels.entryPrice;
      stopLoss = riskLevels.stopLoss;
      takeProfit = riskLevels.takeProfit;
      riskReward = riskLevels.riskReward;
    }

    // Generate reasoning
    const reasoning = this.generateReasoning(
      technicalSignal,
      sentiment,
      signalType,
      combinedConfidence
    );

    // Map indicators to signal format
    const indicators = this.mapIndicators(technicalSignal);

    const tradingSignal: TradingSignal = {
      symbol,
      type: signalType,
      strength: signalStrength,
      confidence: Math.round(combinedConfidence),
      price: currentPrice,
      indicators,
      sentiment: sentiment
        ? {
            score: sentiment.overallScore,
            classification: sentiment.sentiment,
            confidence: sentiment.confidence,
            components: {
              news: sentiment.components.news.score,
              fearGreed: sentiment.components.fearGreed.score,
              social: sentiment.components.social.score,
              whales: sentiment.components.whales.score,
            },
          }
        : undefined,
      reasoning,
      timestamp: Date.now(),
      entryPrice,
      stopLoss,
      takeProfit,
      riskReward,
    };

    // Filter by minimum confidence if specified
    const minConf = options?.minConfidence ?? this.minConfidence;
    if (tradingSignal.confidence < minConf) {
      tradingSignal.type = 'hold';
      tradingSignal.reasoning.unshift(
        `Confidence ${tradingSignal.confidence}% below minimum ${minConf}%`
      );
    }

    return tradingSignal;
  }

  /**
   * Generate signals for multiple symbols
   */
  async generateBatch(
    candlesBySymbol: Map<string, Candle[]>,
    sentimentBySymbol?: Map<string, AggregatedSentiment>,
    options?: Omit<SignalGenerationOptions, 'symbol'>
  ): Promise<Map<string, TradingSignal | null>> {
    const results = new Map<string, TradingSignal | null>();

    for (const [symbol, candles] of candlesBySymbol.entries()) {
      try {
        const sentiment = sentimentBySymbol?.get(symbol);
        const signal = await this.generate(candles, sentiment, {
          ...options,
          symbol,
        });
        results.set(symbol, signal);
      } catch (error) {
        console.error(`Error generating signal for ${symbol}:`, error);
        results.set(symbol, null);
      }
    }

    return results;
  }

  /**
   * Map signal type to numeric score
   */
  private mapSignalToScore(signal: 'BUY' | 'SELL' | 'NEUTRAL'): number {
    switch (signal) {
      case 'BUY':
        return 1;
      case 'SELL':
        return -1;
      case 'NEUTRAL':
        return 0;
    }
  }

  /**
   * Determine final signal type based on combined score and confidence
   */
  private determineSignalType(
    combinedScore: number,
    confidence: number
  ): SignalType {
    // Require higher threshold for action signals
    if (confidence < this.minConfidence) {
      return 'hold';
    }

    if (combinedScore > 0.25) {
      return 'buy';
    } else if (combinedScore < -0.25) {
      return 'sell';
    } else {
      return 'hold';
    }
  }

  /**
   * Determine signal strength
   */
  private determineSignalStrength(
    confidence: number,
    technicalStrength: number
  ): SignalStrength {
    const avgStrength = (confidence + technicalStrength) / 2;

    if (avgStrength >= 75) {
      return 'strong';
    } else if (avgStrength >= 55) {
      return 'moderate';
    } else {
      return 'weak';
    }
  }

  /**
   * Calculate risk management levels
   */
  private calculateRiskLevels(
    currentPrice: number,
    signalType: SignalType,
    candles: Candle[],
    technicalSignal: AggregatedSignal
  ): {
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    riskReward: number;
  } {
    const entryPrice = currentPrice;

    // Calculate ATR for stop loss
    const atrCalculator = new ATRCalculator();
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);
    const atrResult = atrCalculator.calculate(highs, lows, closes);

    const atr = atrResult?.value ?? currentPrice * 0.02; // Fallback to 2% if ATR unavailable

    let stopLoss: number;
    let takeProfit: number;

    if (signalType === 'buy') {
      // Stop loss below entry
      stopLoss = entryPrice - atr * 1.5;

      // Take profit based on risk-reward ratio
      const risk = entryPrice - stopLoss;
      takeProfit = entryPrice + risk * this.riskRewardRatio;
    } else {
      // sell signal
      // Stop loss above entry
      stopLoss = entryPrice + atr * 1.5;

      // Take profit based on risk-reward ratio
      const risk = stopLoss - entryPrice;
      takeProfit = entryPrice - risk * this.riskRewardRatio;
    }

    const riskReward = this.riskRewardRatio;

    return {
      entryPrice: Math.round(entryPrice * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      riskReward,
    };
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    technicalSignal: AggregatedSignal,
    sentiment: AggregatedSentiment | undefined,
    finalSignal: SignalType,
    confidence: number
  ): string[] {
    const reasoning: string[] = [];

    // Overall signal
    reasoning.push(
      `${finalSignal.toUpperCase()} signal with ${confidence.toFixed(1)}% confidence`
    );

    // Technical analysis
    const bullishIndicators: string[] = [];
    const bearishIndicators: string[] = [];

    for (const [name, indicator] of Object.entries(technicalSignal.indicators)) {
      if (indicator.value > 0) {
        bullishIndicators.push(name.toUpperCase());
      } else if (indicator.value < 0) {
        bearishIndicators.push(name.toUpperCase());
      }
    }

    if (bullishIndicators.length > 0) {
      reasoning.push(`Bullish indicators: ${bullishIndicators.join(', ')}`);
    }

    if (bearishIndicators.length > 0) {
      reasoning.push(`Bearish indicators: ${bearishIndicators.join(', ')}`);
    }

    // Sentiment analysis
    if (sentiment) {
      const sentimentDesc =
        sentiment.overallScore > 0.2
          ? 'positive'
          : sentiment.overallScore < -0.2
          ? 'negative'
          : 'neutral';

      reasoning.push(
        `Market sentiment is ${sentimentDesc} (${sentiment.sentiment})`
      );

      // Add component details if significant
      if (sentiment.components.news.count > 0) {
        reasoning.push(
          `News sentiment: ${sentiment.components.news.score.toFixed(2)} (${sentiment.components.news.count} articles)`
        );
      }

      if (sentiment.components.fearGreed.score !== 0) {
        reasoning.push(
          `Fear & Greed Index: ${((sentiment.components.fearGreed.score + 1) * 50).toFixed(0)}/100`
        );
      }
    }

    // Technical strength
    reasoning.push(
      `Technical strength: ${technicalSignal.strength.toFixed(1)}%`
    );

    return reasoning;
  }

  /**
   * Map aggregated indicators to signal format
   */
  private mapIndicators(
    technicalSignal: AggregatedSignal
  ): TradingSignal['indicators'] {
    const indicators: TradingSignal['indicators'] = {};

    for (const [name, indicator] of Object.entries(technicalSignal.indicators)) {
      indicators[name as keyof TradingSignal['indicators']] = {
        value: indicator.value,
        signal: indicator.signal,
        weight: indicator.weight,
      };
    }

    return indicators;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EnhancedSignalGeneratorConfig>): void {
    if (config.sentimentWeight !== undefined) {
      this.sentimentWeight = config.sentimentWeight;
    }
    if (config.technicalWeight !== undefined) {
      this.technicalWeight = config.technicalWeight;
    }
    if (config.minConfidence !== undefined) {
      this.minConfidence = config.minConfidence;
    }
    if (config.riskRewardRatio !== undefined) {
      this.riskRewardRatio = config.riskRewardRatio;
    }

    // Normalize weights
    const totalWeight = this.sentimentWeight + this.technicalWeight;
    this.sentimentWeight = this.sentimentWeight / totalWeight;
    this.technicalWeight = this.technicalWeight / totalWeight;
  }
}
