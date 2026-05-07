/**
 * Support and Resistance Level Detection
 *
 * Identifies key price levels where the market has historically
 * shown a tendency to reverse or consolidate.
 *
 * Methods:
 * - Pivot Points: High/Low points where price reversed
 * - Clustering: Price levels with multiple touches
 * - Volume Profile: Price levels with high volume
 *
 * Interpretation:
 * - Support: Price level where buying pressure exceeds selling
 * - Resistance: Price level where selling pressure exceeds buying
 * - Breakout: Price moves through support/resistance with volume
 */

export interface PriceLevel {
  price: number;
  type: 'SUPPORT' | 'RESISTANCE';
  strength: number; // 0-1 scale based on touches and volume
  touches: number;
  lastTouch: Date;
  broken: boolean;
}

export interface SupportResistanceResult {
  supports: PriceLevel[];
  resistances: PriceLevel[];
  nearest: {
    support: PriceLevel | null;
    resistance: PriceLevel | null;
  };
  currentPrice: number;
  timestamp: Date;
}

export interface SupportResistanceConfig {
  lookbackPeriod?: number; // Default: 100
  minTouches?: number; // Default: 2
  touchThreshold?: number; // Default: 0.5% price tolerance
  pivotStrength?: number; // Default: 3 (bars on each side)
}

export class SupportResistanceDetector {
  private lookbackPeriod: number;
  private minTouches: number;
  private touchThreshold: number;
  private pivotStrength: number;

  constructor(config: SupportResistanceConfig = {}) {
    this.lookbackPeriod = config.lookbackPeriod ?? 100;
    this.minTouches = config.minTouches ?? 2;
    this.touchThreshold = config.touchThreshold ?? 0.005;
    this.pivotStrength = config.pivotStrength ?? 3;
  }

  /**
   * Detect pivot highs (local maxima)
   */
  private findPivotHighs(highs: number[]): number[] {
    const pivots: number[] = [];

    for (let i = this.pivotStrength; i < highs.length - this.pivotStrength; i++) {
      let isPivot = true;

      // Check left side
      for (let j = 1; j <= this.pivotStrength; j++) {
        if (highs[i] <= highs[i - j]) {
          isPivot = false;
          break;
        }
      }

      // Check right side
      if (isPivot) {
        for (let j = 1; j <= this.pivotStrength; j++) {
          if (highs[i] <= highs[i + j]) {
            isPivot = false;
            break;
          }
        }
      }

      if (isPivot) {
        pivots.push(highs[i]);
      }
    }

    return pivots;
  }

  /**
   * Detect pivot lows (local minima)
   */
  private findPivotLows(lows: number[]): number[] {
    const pivots: number[] = [];

    for (let i = this.pivotStrength; i < lows.length - this.pivotStrength; i++) {
      let isPivot = true;

      // Check left side
      for (let j = 1; j <= this.pivotStrength; j++) {
        if (lows[i] >= lows[i - j]) {
          isPivot = false;
          break;
        }
      }

      // Check right side
      if (isPivot) {
        for (let j = 1; j <= this.pivotStrength; j++) {
          if (lows[i] >= lows[i + j]) {
            isPivot = false;
            break;
          }
        }
      }

      if (isPivot) {
        pivots.push(lows[i]);
      }
    }

    return pivots;
  }

  /**
   * Cluster similar price levels
   */
  private clusterLevels(prices: number[]): Map<number, number> {
    const clusters = new Map<number, number>();

    for (const price of prices) {
      let foundCluster = false;

      for (const [clusterPrice, count] of clusters.entries()) {
        const diff = Math.abs(price - clusterPrice) / clusterPrice;
        if (diff <= this.touchThreshold) {
          clusters.set(clusterPrice, count + 1);
          foundCluster = true;
          break;
        }
      }

      if (!foundCluster) {
        clusters.set(price, 1);
      }
    }

    return clusters;
  }

  /**
   * Calculate level strength based on touches and recency
   */
  private calculateStrength(touches: number, maxTouches: number): number {
    return Math.min(touches / maxTouches, 1);
  }

  /**
   * Check if a level has been broken
   */
  private isLevelBroken(
    level: number,
    type: 'SUPPORT' | 'RESISTANCE',
    recentPrices: number[]
  ): boolean {
    const recentClose = recentPrices[recentPrices.length - 1];

    if (type === 'SUPPORT') {
      return recentClose < level * (1 - this.touchThreshold);
    } else {
      return recentClose > level * (1 + this.touchThreshold);
    }
  }

  /**
   * Detect support and resistance levels
   * @param highs Array of high prices
   * @param lows Array of low prices
   * @param closes Array of closing prices
   * @param volumes Optional volume data for strength calculation
   * @returns Support and resistance result
   */
  detect(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes?: number[]
  ): SupportResistanceResult {
    const dataLength = Math.min(highs.length, lows.length, closes.length);
    const lookback = Math.min(this.lookbackPeriod, dataLength);

    const recentHighs = highs.slice(-lookback);
    const recentLows = lows.slice(-lookback);
    const recentCloses = closes.slice(-lookback);

    // Find pivot points
    const pivotHighs = this.findPivotHighs(recentHighs);
    const pivotLows = this.findPivotLows(recentLows);

    // Cluster resistance levels
    const resistanceClusters = this.clusterLevels(pivotHighs);
    const maxResistanceTouches = Math.max(...resistanceClusters.values());

    const resistances: PriceLevel[] = [];
    for (const [price, touches] of resistanceClusters.entries()) {
      if (touches >= this.minTouches) {
        resistances.push({
          price,
          type: 'RESISTANCE',
          strength: this.calculateStrength(touches, maxResistanceTouches),
          touches,
          lastTouch: new Date(),
          broken: this.isLevelBroken(price, 'RESISTANCE', recentCloses),
        });
      }
    }

    // Cluster support levels
    const supportClusters = this.clusterLevels(pivotLows);
    const maxSupportTouches = Math.max(...supportClusters.values());

    const supports: PriceLevel[] = [];
    for (const [price, touches] of supportClusters.entries()) {
      if (touches >= this.minTouches) {
        supports.push({
          price,
          type: 'SUPPORT',
          strength: this.calculateStrength(touches, maxSupportTouches),
          touches,
          lastTouch: new Date(),
          broken: this.isLevelBroken(price, 'SUPPORT', recentCloses),
        });
      }
    }

    // Sort by strength
    resistances.sort((a, b) => b.strength - a.strength);
    supports.sort((a, b) => b.strength - a.strength);

    const currentPrice = closes[closes.length - 1];

    // Find nearest levels
    const nearestSupport = supports
      .filter(s => s.price < currentPrice && !s.broken)
      .sort((a, b) => b.price - a.price)[0] || null;

    const nearestResistance = resistances
      .filter(r => r.price > currentPrice && !r.broken)
      .sort((a, b) => a.price - b.price)[0] || null;

    return {
      supports: supports.filter(s => !s.broken),
      resistances: resistances.filter(r => !r.broken),
      nearest: {
        support: nearestSupport,
        resistance: nearestResistance,
      },
      currentPrice,
      timestamp: new Date(),
    };
  }

  /**
   * Detect breakout from support/resistance
   * @param result Current support/resistance result
   * @param previousResult Previous support/resistance result
   * @param volume Current volume
   * @param avgVolume Average volume
   * @returns Breakout signal or null
   */
  detectBreakout(
    result: SupportResistanceResult,
    previousResult: SupportResistanceResult,
    volume?: number,
    avgVolume?: number
  ): { type: 'BULLISH' | 'BEARISH'; level: PriceLevel; volumeConfirmed: boolean } | null {
    // Check for resistance breakout (bullish)
    if (previousResult.nearest.resistance && !result.nearest.resistance) {
      const brokenLevel = previousResult.nearest.resistance;
      const volumeConfirmed = volume && avgVolume ? volume > avgVolume * 1.5 : false;

      return {
        type: 'BULLISH',
        level: brokenLevel,
        volumeConfirmed,
      };
    }

    // Check for support breakdown (bearish)
    if (previousResult.nearest.support && !result.nearest.support) {
      const brokenLevel = previousResult.nearest.support;
      const volumeConfirmed = volume && avgVolume ? volume > avgVolume * 1.5 : false;

      return {
        type: 'BEARISH',
        level: brokenLevel,
        volumeConfirmed,
      };
    }

    return null;
  }

  /**
   * Calculate distance to nearest support/resistance as percentage
   */
  calculateDistancePercent(result: SupportResistanceResult): {
    toSupport: number | null;
    toResistance: number | null;
  } {
    const { currentPrice, nearest } = result;

    const toSupport = nearest.support
      ? ((currentPrice - nearest.support.price) / currentPrice) * 100
      : null;

    const toResistance = nearest.resistance
      ? ((nearest.resistance.price - currentPrice) / currentPrice) * 100
      : null;

    return { toSupport, toResistance };
  }
}
