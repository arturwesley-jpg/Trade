/**
 * Bollinger Bands Calculator
 *
 * Bollinger Bands consist of a middle band (SMA) and two outer bands
 * that are standard deviations away from the middle band.
 *
 * Components:
 * - Middle Band: 20-period SMA
 * - Upper Band: Middle Band + (2 * Standard Deviation)
 * - Lower Band: Middle Band - (2 * Standard Deviation)
 *
 * Interpretation:
 * - Price near upper band: Overbought
 * - Price near lower band: Oversold
 * - Bands squeeze: Low volatility, potential breakout
 * - Bands expand: High volatility
 */

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number; // (upper - lower) / middle
  percentB: number; // (price - lower) / (upper - lower)
  signal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
  squeeze: boolean; // True if bandwidth is unusually narrow
  timestamp: Date;
}

export interface BollingerBandsConfig {
  period?: number; // Default: 20
  stdDev?: number; // Default: 2
  squeezeThreshold?: number; // Default: 0.1 (10% bandwidth)
}

export class BollingerBandsCalculator {
  private period: number;
  private stdDev: number;
  private squeezeThreshold: number;

  constructor(config: BollingerBandsConfig = {}) {
    this.period = config.period ?? 20;
    this.stdDev = config.stdDev ?? 2;
    this.squeezeThreshold = config.squeezeThreshold ?? 0.1;
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(prices: number[]): number {
    return prices.reduce((a, b) => a + b, 0) / prices.length;
  }

  /**
   * Calculate Standard Deviation
   */
  private calculateStdDev(prices: number[], mean: number): number {
    const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate Bollinger Bands from price data
   * @param prices Array of closing prices (oldest first)
   * @param currentPrice Current price for %B calculation
   * @returns Bollinger Bands result or null if insufficient data
   */
  calculate(prices: number[], currentPrice?: number): BollingerBandsResult | null {
    if (prices.length < this.period) {
      return null;
    }

    // Get last N prices
    const recentPrices = prices.slice(-this.period);

    // Calculate middle band (SMA)
    const middle = this.calculateSMA(recentPrices);

    // Calculate standard deviation
    const stdDevValue = this.calculateStdDev(recentPrices, middle);

    // Calculate upper and lower bands
    const upper = middle + this.stdDev * stdDevValue;
    const lower = middle - this.stdDev * stdDevValue;

    // Calculate bandwidth
    const bandwidth = (upper - lower) / middle;

    // Detect squeeze
    const squeeze = bandwidth < this.squeezeThreshold;

    // Use current price or last price for %B calculation
    const price = currentPrice ?? prices[prices.length - 1];

    // Calculate %B (position within bands)
    const percentB = (price - lower) / (upper - lower);

    // Determine signal
    let signal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
    if (percentB > 1) {
      signal = 'OVERBOUGHT';
    } else if (percentB < 0) {
      signal = 'OVERSOLD';
    } else {
      signal = 'NEUTRAL';
    }

    return {
      upper,
      middle,
      lower,
      bandwidth,
      percentB,
      signal,
      squeeze,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate Bollinger Bands series for all data points
   * @param prices Array of closing prices
   * @returns Array of Bollinger Bands results (null for insufficient data points)
   */
  calculateSeries(prices: number[]): (BollingerBandsResult | null)[] {
    const results: (BollingerBandsResult | null)[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < this.period - 1) {
        results.push(null);
        continue;
      }

      const slice = prices.slice(0, i + 1);
      const result = this.calculate(slice);
      results.push(result);
    }

    return results;
  }

  /**
   * Detect Bollinger Band squeeze breakout
   * @param recentBands Recent Bollinger Bands results
   * @returns Breakout direction or null
   */
  detectBreakout(recentBands: BollingerBandsResult[]): 'BULLISH' | 'BEARISH' | null {
    if (recentBands.length < 3) {
      return null;
    }

    const [older, middle, latest] = recentBands.slice(-3);

    // Check if we had a squeeze that's now breaking out
    const hadSqueeze = older.squeeze || middle.squeeze;
    const breakingOut = !latest.squeeze;

    if (!hadSqueeze || !breakingOut) {
      return null;
    }

    // Determine breakout direction based on %B
    if (latest.percentB > 0.8) {
      return 'BULLISH';
    } else if (latest.percentB < 0.2) {
      return 'BEARISH';
    }

    return null;
  }

  /**
   * Detect Bollinger Band walk (sustained move along one band)
   * @param recentBands Recent Bollinger Bands results
   * @param minConsecutive Minimum consecutive periods near band
   * @returns Walk type or null
   */
  detectWalk(
    recentBands: BollingerBandsResult[],
    minConsecutive: number = 3
  ): 'UPPER_WALK' | 'LOWER_WALK' | null {
    if (recentBands.length < minConsecutive) {
      return null;
    }

    const recent = recentBands.slice(-minConsecutive);

    // Check for upper band walk (strong uptrend)
    const upperWalk = recent.every(band => band.percentB > 0.9);
    if (upperWalk) {
      return 'UPPER_WALK';
    }

    // Check for lower band walk (strong downtrend)
    const lowerWalk = recent.every(band => band.percentB < 0.1);
    if (lowerWalk) {
      return 'LOWER_WALK';
    }

    return null;
  }
}
