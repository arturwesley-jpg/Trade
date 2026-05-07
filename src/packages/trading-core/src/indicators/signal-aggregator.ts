/**
 * Multi-Indicator Signal Aggregator
 *
 * Combines signals from multiple technical indicators to generate
 * a unified trading signal with confidence scoring.
 *
 * Aggregation Strategy:
 * - Weighted voting based on indicator reliability
 * - Confluence detection (multiple indicators agreeing)
 * - Divergence penalty (indicators disagreeing)
 * - Time-decay for older signals
 */

import type { Candle } from '@trading-bot/market-data';
import {
  RSICalculator,
  MACDCalculator,
  BollingerBandsCalculator,
  StochasticCalculator,
  OBVCalculator,
  ADXCalculator,
  ATRCalculator,
  SupportResistanceDetector,
} from './index';

export interface AggregatedSignal {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number; // 0-100
  strength: number; // 0-100
  indicators: {
    rsi: { signal: string; value: number; weight: number };
    macd: { signal: string; value: number; weight: number };
    bollinger: { signal: string; value: number; weight: number };
    stochastic: { signal: string; value: number; weight: number };
    obv: { signal: string; value: number; weight: number };
    adx: { signal: string; value: number; weight: number };
    atr: { signal: string; value: number; weight: number };
    supportResistance: { signal: string; value: number; weight: number };
  };
  explanation: string;
  timestamp: Date;
}

export interface SignalAggregatorConfig {
  weights?: {
    rsi?: number;
    macd?: number;
    bollinger?: number;
    stochastic?: number;
    obv?: number;
    adx?: number;
    atr?: number;
    supportResistance?: number;
  };
  minConfidence?: number; // Minimum confidence to generate signal (default: 60)
}

export class SignalAggregator {
  private rsi: RSICalculator;
  private macd: MACDCalculator;
  private bollinger: BollingerBandsCalculator;
  private stochastic: StochasticCalculator;
  private obv: OBVCalculator;
  private adx: ADXCalculator;
  private atr: ATRCalculator;
  private supportResistance: SupportResistanceDetector;

  private weights: Required<NonNullable<SignalAggregatorConfig['weights']>>;
  private minConfidence: number;

  constructor(config: SignalAggregatorConfig = {}) {
    this.rsi = new RSICalculator();
    this.macd = new MACDCalculator();
    this.bollinger = new BollingerBandsCalculator();
    this.stochastic = new StochasticCalculator();
    this.obv = new OBVCalculator();
    this.adx = new ADXCalculator();
    this.atr = new ATRCalculator();
    this.supportResistance = new SupportResistanceDetector();

    this.weights = {
      rsi: config.weights?.rsi ?? 1.2,
      macd: config.weights?.macd ?? 1.5,
      bollinger: config.weights?.bollinger ?? 1.0,
      stochastic: config.weights?.stochastic ?? 1.0,
      obv: config.weights?.obv ?? 0.8,
      adx: config.weights?.adx ?? 1.3,
      atr: config.weights?.atr ?? 0.5,
      supportResistance: config.weights?.supportResistance ?? 1.4,
    };

    this.minConfidence = config.minConfidence ?? 60;
  }

  /**
   * Convert indicator signal to numeric score
   * @returns -1 (bearish), 0 (neutral), 1 (bullish)
   */
  private signalToScore(signal: string): number {
    const upperSignal = signal.toUpperCase();
    if (upperSignal.includes('BULL') || upperSignal.includes('BUY') || upperSignal === 'UP') {
      return 1;
    }
    if (upperSignal.includes('BEAR') || upperSignal.includes('SELL') || upperSignal === 'DOWN') {
      return -1;
    }
    return 0;
  }

  /**
   * Aggregate signals from all indicators
   * @param candles Array of OHLCV candles (minimum 100 recommended)
   * @returns Aggregated signal with confidence score
   */
  aggregate(candles: Candle[]): AggregatedSignal | null {
    if (candles.length < 50) {
      return null;
    }

    const symbol = candles[0].symbol;
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    // Calculate all indicators
    const rsiResult = this.rsi.calculate(closes);
    const macdResult = this.macd.calculate(closes);
    const bollingerResult = this.bollinger.calculate(closes);
    const stochasticResult = this.stochastic.calculate(highs, lows, closes);
    const obvResult = this.obv.calculate(closes, volumes);
    const adxResult = this.adx.calculate(highs, lows, closes);
    const atrResult = this.atr.calculate(highs, lows, closes);
    const srResult = this.supportResistance.detect(highs, lows, closes, volumes);

    if (!rsiResult || !macdResult || !bollingerResult || !stochasticResult ||
        !obvResult || !adxResult || !atrResult) {
      return null;
    }

    // Calculate weighted scores
    const indicators = {
      rsi: {
        signal: rsiResult.signal,
        value: this.signalToScore(rsiResult.signal) * rsiResult.strength,
        weight: this.weights.rsi,
      },
      macd: {
        signal: macdResult.crossover !== 'NONE' ? macdResult.crossover : 'NEUTRAL',
        value: this.signalToScore(macdResult.crossover) * macdResult.strength,
        weight: this.weights.macd,
      },
      bollinger: {
        signal: bollingerResult.signal,
        value: this.signalToScore(bollingerResult.signal) * Math.abs(bollingerResult.percentB - 0.5) * 2,
        weight: this.weights.bollinger,
      },
      stochastic: {
        signal: stochasticResult.crossover !== 'NONE' ? stochasticResult.crossover : stochasticResult.signal,
        value: this.signalToScore(stochasticResult.crossover !== 'NONE' ? stochasticResult.crossover : stochasticResult.signal) * stochasticResult.strength,
        weight: this.weights.stochastic,
      },
      obv: {
        signal: obvResult.signal,
        value: this.signalToScore(obvResult.signal) * (obvResult.trend === 'FLAT' ? 0.5 : 1),
        weight: this.weights.obv,
      },
      adx: {
        signal: adxResult.trendDirection,
        value: this.signalToScore(adxResult.trendDirection) * (adxResult.adx / 100),
        weight: this.weights.adx * (adxResult.trendStrength === 'STRONG' ? 1.5 : adxResult.trendStrength === 'MODERATE' ? 1 : 0.5),
      },
      atr: {
        signal: atrResult.volatility,
        value: atrResult.volatility === 'HIGH' ? 0.5 : atrResult.volatility === 'LOW' ? -0.5 : 0,
        weight: this.weights.atr,
      },
      supportResistance: {
        signal: this.getSRSignal(srResult),
        value: this.getSRScore(srResult),
        weight: this.weights.supportResistance,
      },
    };

    // Calculate weighted average
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const [key, indicator] of Object.entries(indicators)) {
      totalWeightedScore += indicator.value * indicator.weight;
      totalWeight += indicator.weight;
    }

    const averageScore = totalWeightedScore / totalWeight;

    // Determine signal
    let signal: 'BUY' | 'SELL' | 'NEUTRAL';
    if (averageScore > 0.2) {
      signal = 'BUY';
    } else if (averageScore < -0.2) {
      signal = 'SELL';
    } else {
      signal = 'NEUTRAL';
    }

    // Calculate confidence (0-100)
    const confidence = Math.min(Math.abs(averageScore) * 100, 100);

    // Calculate strength based on indicator agreement
    const bullishCount = Object.values(indicators).filter(i => i.value > 0).length;
    const bearishCount = Object.values(indicators).filter(i => i.value < 0).length;
    const agreement = Math.max(bullishCount, bearishCount) / Object.keys(indicators).length;
    const strength = agreement * 100;

    // Generate explanation
    const explanation = this.generateExplanation(signal, indicators, confidence, strength);

    // Only return signal if confidence meets threshold
    if (confidence < this.minConfidence) {
      signal = 'NEUTRAL';
    }

    return {
      symbol,
      signal,
      confidence,
      strength,
      indicators,
      explanation,
      timestamp: new Date(),
    };
  }

  private getSRSignal(srResult: any): string {
    const { currentPrice, nearest } = srResult;

    if (!nearest.support && !nearest.resistance) {
      return 'NEUTRAL';
    }

    if (nearest.resistance) {
      const distanceToResistance = ((nearest.resistance.price - currentPrice) / currentPrice) * 100;
      if (distanceToResistance < 1) {
        return 'BEARISH'; // Near resistance
      }
    }

    if (nearest.support) {
      const distanceToSupport = ((currentPrice - nearest.support.price) / currentPrice) * 100;
      if (distanceToSupport < 1) {
        return 'BULLISH'; // Near support
      }
    }

    return 'NEUTRAL';
  }

  private getSRScore(srResult: any): number {
    const signal = this.getSRSignal(srResult);
    const { currentPrice, nearest } = srResult;

    if (signal === 'NEUTRAL') return 0;

    if (signal === 'BULLISH' && nearest.support) {
      const distance = ((currentPrice - nearest.support.price) / currentPrice) * 100;
      return Math.max(0, 1 - distance) * nearest.support.strength;
    }

    if (signal === 'BEARISH' && nearest.resistance) {
      const distance = ((nearest.resistance.price - currentPrice) / currentPrice) * 100;
      return -Math.max(0, 1 - distance) * nearest.resistance.strength;
    }

    return 0;
  }

  private generateExplanation(
    signal: 'BUY' | 'SELL' | 'NEUTRAL',
    indicators: AggregatedSignal['indicators'],
    confidence: number,
    strength: number
  ): string {
    const parts: string[] = [];

    parts.push(`Signal: ${signal} (${confidence.toFixed(1)}% confidence, ${strength.toFixed(1)}% strength)`);

    const bullishIndicators = Object.entries(indicators)
      .filter(([_, ind]) => ind.value > 0)
      .map(([name, _]) => name.toUpperCase());

    const bearishIndicators = Object.entries(indicators)
      .filter(([_, ind]) => ind.value < 0)
      .map(([name, _]) => name.toUpperCase());

    if (bullishIndicators.length > 0) {
      parts.push(`Bullish: ${bullishIndicators.join(', ')}`);
    }

    if (bearishIndicators.length > 0) {
      parts.push(`Bearish: ${bearishIndicators.join(', ')}`);
    }

    return parts.join(' | ');
  }
}
