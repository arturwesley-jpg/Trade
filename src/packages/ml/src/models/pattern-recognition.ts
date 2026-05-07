/**
 * Pattern Recognition System
 * Detects chart patterns, candlestick patterns, and support/resistance levels
 */

import type { Candle } from '@trade/shared';

export interface ChartPattern {
  type: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  description: string;
  priceTarget?: number;
  breakoutLevel?: number;
}

export interface CandlestickPattern {
  type: string;
  confidence: number;
  index: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  description: string;
}

export interface SupportResistanceLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number;
  touches: number;
  lastTouch: number;
}

export interface TrendInfo {
  direction: 'uptrend' | 'downtrend' | 'sideways';
  strength: number;
  startIndex: number;
  slope: number;
}

export class PatternRecognition {
  /**
   * Detect chart patterns (head & shoulders, triangles, flags, etc.)
   */
  static detectChartPatterns(candles: Candle[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];

    // Head and Shoulders
    patterns.push(...this.detectHeadAndShoulders(candles));

    // Inverse Head and Shoulders
    patterns.push(...this.detectInverseHeadAndShoulders(candles));

    // Double Top
    patterns.push(...this.detectDoubleTop(candles));

    // Double Bottom
    patterns.push(...this.detectDoubleBottom(candles));

    // Triangles
    patterns.push(...this.detectTriangles(candles));

    // Flags and Pennants
    patterns.push(...this.detectFlags(candles));

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect candlestick patterns
   */
  static detectCandlestickPatterns(candles: Candle[]): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];

    for (let i = 2; i < candles.length; i++) {
      // Doji
      const doji = this.isDoji(candles[i]);
      if (doji) {
        patterns.push({
          type: 'Doji',
          confidence: doji.confidence,
          index: i,
          signal: 'neutral',
          description: 'Indecision in the market'
        });
      }

      // Hammer
      const hammer = this.isHammer(candles[i]);
      if (hammer) {
        patterns.push({
          type: 'Hammer',
          confidence: hammer.confidence,
          index: i,
          signal: 'bullish',
          description: 'Potential bullish reversal'
        });
      }

      // Shooting Star
      const shootingStar = this.isShootingStar(candles[i]);
      if (shootingStar) {
        patterns.push({
          type: 'Shooting Star',
          confidence: shootingStar.confidence,
          index: i,
          signal: 'bearish',
          description: 'Potential bearish reversal'
        });
      }

      // Engulfing patterns (need previous candle)
      if (i >= 1) {
        const bullishEngulfing = this.isBullishEngulfing(candles[i - 1], candles[i]);
        if (bullishEngulfing) {
          patterns.push({
            type: 'Bullish Engulfing',
            confidence: bullishEngulfing.confidence,
            index: i,
            signal: 'bullish',
            description: 'Strong bullish reversal signal'
          });
        }

        const bearishEngulfing = this.isBearishEngulfing(candles[i - 1], candles[i]);
        if (bearishEngulfing) {
          patterns.push({
            type: 'Bearish Engulfing',
            confidence: bearishEngulfing.confidence,
            index: i,
            signal: 'bearish',
            description: 'Strong bearish reversal signal'
          });
        }
      }

      // Three-candle patterns
      if (i >= 2) {
        const morningStar = this.isMorningStar(candles[i - 2], candles[i - 1], candles[i]);
        if (morningStar) {
          patterns.push({
            type: 'Morning Star',
            confidence: morningStar.confidence,
            index: i,
            signal: 'bullish',
            description: 'Three-candle bullish reversal'
          });
        }

        const eveningStar = this.isEveningStar(candles[i - 2], candles[i - 1], candles[i]);
        if (eveningStar) {
          patterns.push({
            type: 'Evening Star',
            confidence: eveningStar.confidence,
            index: i,
            signal: 'bearish',
            description: 'Three-candle bearish reversal'
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Detect support and resistance levels
   */
  static detectSupportResistance(candles: Candle[], tolerance: number = 0.02): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    const pricePoints: { price: number; timestamp: number; type: 'high' | 'low' }[] = [];

    // Find local highs and lows
    for (let i = 2; i < candles.length - 2; i++) {
      const isLocalHigh = candles[i].high > candles[i - 1].high &&
                          candles[i].high > candles[i - 2].high &&
                          candles[i].high > candles[i + 1].high &&
                          candles[i].high > candles[i + 2].high;

      const isLocalLow = candles[i].low < candles[i - 1].low &&
                         candles[i].low < candles[i - 2].low &&
                         candles[i].low < candles[i + 1].low &&
                         candles[i].low < candles[i + 2].low;

      if (isLocalHigh) {
        pricePoints.push({ price: candles[i].high, timestamp: candles[i].timestamp, type: 'high' });
      }
      if (isLocalLow) {
        pricePoints.push({ price: candles[i].low, timestamp: candles[i].timestamp, type: 'low' });
      }
    }

    // Cluster similar price points
    const clusters: { price: number; touches: number; lastTouch: number; type: 'high' | 'low' }[] = [];

    for (const point of pricePoints) {
      let foundCluster = false;

      for (const cluster of clusters) {
        const priceDiff = Math.abs(cluster.price - point.price) / cluster.price;
        if (priceDiff <= tolerance) {
          cluster.touches++;
          cluster.lastTouch = Math.max(cluster.lastTouch, point.timestamp);
          cluster.price = (cluster.price * (cluster.touches - 1) + point.price) / cluster.touches;
          foundCluster = true;
          break;
        }
      }

      if (!foundCluster) {
        clusters.push({
          price: point.price,
          touches: 1,
          lastTouch: point.timestamp,
          type: point.type
        });
      }
    }

    // Convert clusters to levels
    const currentPrice = candles[candles.length - 1].close;

    for (const cluster of clusters) {
      if (cluster.touches >= 2) {
        const type = cluster.price > currentPrice ? 'resistance' : 'support';
        const strength = Math.min(cluster.touches / 5, 1);

        levels.push({
          price: cluster.price,
          type,
          strength,
          touches: cluster.touches,
          lastTouch: cluster.lastTouch
        });
      }
    }

    return levels.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Detect trend direction and strength
   */
  static detectTrend(candles: Candle[], period: number = 20): TrendInfo {
    if (candles.length < period) {
      return { direction: 'sideways', strength: 0, startIndex: 0, slope: 0 };
    }

    const recentCandles = candles.slice(-period);
    const prices = recentCandles.map(c => c.close);

    // Linear regression
    const n = prices.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = prices.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * prices[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const yMean = sumY / n;
    const ssRes = prices.reduce((sum, y, i) => {
      const yPred = slope * i + intercept;
      return sum + Math.pow(y - yPred, 2);
    }, 0);
    const ssTot = prices.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const r2 = 1 - (ssRes / ssTot);

    // Determine direction
    const avgPrice = sumY / n;
    const slopePercent = (slope / avgPrice) * 100;

    let direction: 'uptrend' | 'downtrend' | 'sideways';
    if (slopePercent > 0.1 && r2 > 0.5) {
      direction = 'uptrend';
    } else if (slopePercent < -0.1 && r2 > 0.5) {
      direction = 'downtrend';
    } else {
      direction = 'sideways';
    }

    return {
      direction,
      strength: r2,
      startIndex: candles.length - period,
      slope: slopePercent
    };
  }

  // Chart Pattern Detection Methods

  private static detectHeadAndShoulders(candles: Candle[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];
    const minPatternLength = 20;

    for (let i = minPatternLength; i < candles.length - 5; i++) {
      const window = candles.slice(i - minPatternLength, i);
      const highs = window.map(c => c.high);

      // Find three peaks
      const peaks = this.findPeaks(highs, 3);
      if (peaks.length !== 3) continue;

      const [leftShoulder, head, rightShoulder] = peaks;

      // Validate head and shoulders pattern
      const headHeight = highs[head];
      const leftShoulderHeight = highs[leftShoulder];
      const rightShoulderHeight = highs[rightShoulder];

      if (
        headHeight > leftShoulderHeight * 1.05 &&
        headHeight > rightShoulderHeight * 1.05 &&
        Math.abs(leftShoulderHeight - rightShoulderHeight) / leftShoulderHeight < 0.05
      ) {
        const neckline = Math.min(
          window[leftShoulder + 1]?.low || Infinity,
          window[head + 1]?.low || Infinity
        );

        patterns.push({
          type: 'Head and Shoulders',
          confidence: 0.75,
          startIndex: i - minPatternLength,
          endIndex: i,
          description: 'Bearish reversal pattern',
          priceTarget: neckline - (headHeight - neckline),
          breakoutLevel: neckline
        });
      }
    }

    return patterns;
  }

  private static detectInverseHeadAndShoulders(candles: Candle[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];
    const minPatternLength = 20;

    for (let i = minPatternLength; i < candles.length - 5; i++) {
      const window = candles.slice(i - minPatternLength, i);
      const lows = window.map(c => c.low);

      // Find three troughs
      const troughs = this.findTroughs(lows, 3);
      if (troughs.length !== 3) continue;

      const [leftShoulder, head, rightShoulder] = troughs;

      // Validate inverse head and shoulders pattern
      const headDepth = lows[head];
      const leftShoulderDepth = lows[leftShoulder];
      const rightShoulderDepth = lows[rightShoulder];

      if (
        headDepth < leftShoulderDepth * 0.95 &&
        headDepth < rightShoulderDepth * 0.95 &&
        Math.abs(leftShoulderDepth - rightShoulderDepth) / leftShoulderDepth < 0.05
      ) {
        const neckline = Math.max(
          window[leftShoulder + 1]?.high || 0,
          window[head + 1]?.high || 0
        );

        patterns.push({
          type: 'Inverse Head and Shoulders',
          confidence: 0.75,
          startIndex: i - minPatternLength,
          endIndex: i,
          description: 'Bullish reversal pattern',
          priceTarget: neckline + (neckline - headDepth),
          breakoutLevel: neckline
        });
      }
    }

    return patterns;
  }

  private static detectDoubleTop(candles: Candle[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];
    const minPatternLength = 15;

    for (let i = minPatternLength; i < candles.length - 3; i++) {
      const window = candles.slice(i - minPatternLength, i);
      const highs = window.map(c => c.high);

      const peaks = this.findPeaks(highs, 2);
      if (peaks.length !== 2) continue;

      const [peak1, peak2] = peaks;
      const peak1Height = highs[peak1];
      const peak2Height = highs[peak2];

      // Validate double top
      if (Math.abs(peak1Height - peak2Height) / peak1Height < 0.03) {
        const valley = Math.min(...highs.slice(peak1, peak2));

        patterns.push({
          type: 'Double Top',
          confidence: 0.7,
          startIndex: i - minPatternLength,
          endIndex: i,
          description: 'Bearish reversal pattern',
          priceTarget: valley - (peak1Height - valley),
          breakoutLevel: valley
        });
      }
    }

    return patterns;
  }

  private static detectDoubleBottom(candles: Candle[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];
    const minPatternLength = 15;

    for (let i = minPatternLength; i < candles.length - 3; i++) {
      const window = candles.slice(i - minPatternLength, i);
      const lows = window.map(c => c.low);

      const troughs = this.findTroughs(lows, 2);
      if (troughs.length !== 2) continue;

      const [trough1, trough2] = troughs;
      const trough1Depth = lows[trough1];
      const trough2Depth = lows[trough2];

      // Validate double bottom
      if (Math.abs(trough1Depth - trough2Depth) / trough1Depth < 0.03) {
        const peak = Math.max(...lows.slice(trough1, trough2));

        patterns.push({
          type: 'Double Bottom',
          confidence: 0.7,
          startIndex: i - minPatternLength,
          endIndex: i,
          description: 'Bullish reversal pattern',
          priceTarget: peak + (peak - trough1Depth),
          breakoutLevel: peak
        });
      }
    }

    return patterns;
  }

  private static detectTriangles(candles: Candle[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];
    const minPatternLength = 20;

    for (let i = minPatternLength; i < candles.length - 5; i++) {
      const window = candles.slice(i - minPatternLength, i);

      // Calculate trend lines
      const highs = window.map((c, idx) => ({ price: c.high, index: idx }));
      const lows = window.map((c, idx) => ({ price: c.low, index: idx }));

      const upperTrend = this.calculateTrendLine(highs);
      const lowerTrend = this.calculateTrendLine(lows);

      // Ascending triangle
      if (Math.abs(upperTrend.slope) < 0.001 && lowerTrend.slope > 0.01) {
        patterns.push({
          type: 'Ascending Triangle',
          confidence: 0.65,
          startIndex: i - minPatternLength,
          endIndex: i,
          description: 'Bullish continuation pattern',
          breakoutLevel: upperTrend.intercept
        });
      }

      // Descending triangle
      if (Math.abs(lowerTrend.slope) < 0.001 && upperTrend.slope < -0.01) {
        patterns.push({
          type: 'Descending Triangle',
          confidence: 0.65,
          startIndex: i - minPatternLength,
          endIndex: i,
          description: 'Bearish continuation pattern',
          breakoutLevel: lowerTrend.intercept
        });
      }

      // Symmetrical triangle
      if (upperTrend.slope < -0.01 && lowerTrend.slope > 0.01) {
        patterns.push({
          type: 'Symmetrical Triangle',
          confidence: 0.6,
          startIndex: i - minPatternLength,
          endIndex: i,
          description: 'Continuation pattern (direction uncertain)'
        });
      }
    }

    return patterns;
  }

  private static detectFlags(candles: Candle[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];
    const flagLength = 10;
    const poleLength = 15;

    for (let i = poleLength + flagLength; i < candles.length; i++) {
      const pole = candles.slice(i - poleLength - flagLength, i - flagLength);
      const flag = candles.slice(i - flagLength, i);

      // Check for strong pole (trend)
      const poleStart = pole[0].close;
      const poleEnd = pole[pole.length - 1].close;
      const poleChange = (poleEnd - poleStart) / poleStart;

      if (Math.abs(poleChange) < 0.05) continue;

      // Check for consolidation in flag
      const flagHigh = Math.max(...flag.map(c => c.high));
      const flagLow = Math.min(...flag.map(c => c.low));
      const flagRange = (flagHigh - flagLow) / flagLow;

      if (flagRange < 0.05) {
        const type = poleChange > 0 ? 'Bullish Flag' : 'Bearish Flag';
        patterns.push({
          type,
          confidence: 0.65,
          startIndex: i - poleLength - flagLength,
          endIndex: i,
          description: `${poleChange > 0 ? 'Bullish' : 'Bearish'} continuation pattern`,
          breakoutLevel: poleChange > 0 ? flagHigh : flagLow
        });
      }
    }

    return patterns;
  }

  // Candlestick Pattern Detection Methods

  private static isDoji(candle: Candle): { confidence: number } | null {
    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;

    if (range === 0) return null;

    const bodyRatio = body / range;

    if (bodyRatio < 0.1) {
      return { confidence: 1 - bodyRatio * 10 };
    }

    return null;
  }

  private static isHammer(candle: Candle): { confidence: number } | null {
    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;
    const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
    const upperShadow = candle.high - Math.max(candle.open, candle.close);

    if (range === 0) return null;

    if (lowerShadow > body * 2 && upperShadow < body * 0.5) {
      const confidence = Math.min(lowerShadow / (body * 3), 1);
      return { confidence };
    }

    return null;
  }

  private static isShootingStar(candle: Candle): { confidence: number } | null {
    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;
    const upperShadow = candle.high - Math.max(candle.open, candle.close);
    const lowerShadow = Math.min(candle.open, candle.close) - candle.low;

    if (range === 0) return null;

    if (upperShadow > body * 2 && lowerShadow < body * 0.5) {
      const confidence = Math.min(upperShadow / (body * 3), 1);
      return { confidence };
    }

    return null;
  }

  private static isBullishEngulfing(prev: Candle, current: Candle): { confidence: number } | null {
    const prevBearish = prev.close < prev.open;
    const currentBullish = current.close > current.open;

    if (prevBearish && currentBullish) {
      if (current.open < prev.close && current.close > prev.open) {
        const engulfRatio = (current.close - current.open) / (prev.open - prev.close);
        const confidence = Math.min(engulfRatio / 2, 1);
        return { confidence };
      }
    }

    return null;
  }

  private static isBearishEngulfing(prev: Candle, current: Candle): { confidence: number } | null {
    const prevBullish = prev.close > prev.open;
    const currentBearish = current.close < current.open;

    if (prevBullish && currentBearish) {
      if (current.open > prev.close && current.close < prev.open) {
        const engulfRatio = (current.open - current.close) / (prev.close - prev.open);
        const confidence = Math.min(engulfRatio / 2, 1);
        return { confidence };
      }
    }

    return null;
  }

  private static isMorningStar(first: Candle, second: Candle, third: Candle): { confidence: number } | null {
    const firstBearish = first.close < first.open;
    const secondSmall = Math.abs(second.close - second.open) < Math.abs(first.close - first.open) * 0.3;
    const thirdBullish = third.close > third.open;

    if (firstBearish && secondSmall && thirdBullish) {
      if (third.close > (first.open + first.close) / 2) {
        return { confidence: 0.8 };
      }
    }

    return null;
  }

  private static isEveningStar(first: Candle, second: Candle, third: Candle): { confidence: number } | null {
    const firstBullish = first.close > first.open;
    const secondSmall = Math.abs(second.close - second.open) < Math.abs(first.close - first.open) * 0.3;
    const thirdBearish = third.close < third.open;

    if (firstBullish && secondSmall && thirdBearish) {
      if (third.close < (first.open + first.close) / 2) {
        return { confidence: 0.8 };
      }
    }

    return null;
  }

  // Helper Methods

  private static findPeaks(data: number[], numPeaks: number): number[] {
    const peaks: { index: number; value: number }[] = [];

    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
        peaks.push({ index: i, value: data[i] });
      }
    }

    return peaks
      .sort((a, b) => b.value - a.value)
      .slice(0, numPeaks)
      .map(p => p.index)
      .sort((a, b) => a - b);
  }

  private static findTroughs(data: number[], numTroughs: number): number[] {
    const troughs: { index: number; value: number }[] = [];

    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] < data[i - 1] && data[i] < data[i + 1]) {
        troughs.push({ index: i, value: data[i] });
      }
    }

    return troughs
      .sort((a, b) => a.value - b.value)
      .slice(0, numTroughs)
      .map(t => t.index)
      .sort((a, b) => a - b);
  }

  private static calculateTrendLine(points: { price: number; index: number }[]): { slope: number; intercept: number } {
    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.index, 0);
    const sumY = points.reduce((sum, p) => sum + p.price, 0);
    const sumXY = points.reduce((sum, p) => sum + p.index * p.price, 0);
    const sumX2 = points.reduce((sum, p) => sum + p.index * p.index, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }
}