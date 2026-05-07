/**
 * OBV (On-Balance Volume) Calculator
 *
 * OBV is a momentum indicator that uses volume flow to predict
 * changes in stock price. It adds volume on up days and subtracts
 * volume on down days.
 *
 * Formula:
 * - If close > previous close: OBV = previous OBV + volume
 * - If close < previous close: OBV = previous OBV - volume
 * - If close = previous close: OBV = previous OBV
 *
 * Interpretation:
 * - Rising OBV: Buying pressure, bullish
 * - Falling OBV: Selling pressure, bearish
 * - OBV divergence from price: Potential reversal
 */

export interface OBVResult {
  value: number;
  trend: 'RISING' | 'FALLING' | 'FLAT';
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  divergence: 'BULLISH' | 'BEARISH' | null;
  timestamp: Date;
}

export interface OBVConfig {
  trendPeriod?: number; // Period for trend detection (default: 10)
  divergencePeriod?: number; // Period for divergence detection (default: 20)
}

export class OBVCalculator {
  private trendPeriod: number;
  private divergencePeriod: number;

  constructor(config: OBVConfig = {}) {
    this.trendPeriod = config.trendPeriod ?? 10;
    this.divergencePeriod = config.divergencePeriod ?? 20;
  }

  /**
   * Calculate OBV from price and volume data
   * @param closes Array of closing prices
   * @param volumes Array of volumes
   * @returns OBV result or null if insufficient data
   */
  calculate(closes: number[], volumes: number[]): OBVResult | null {
    if (closes.length < 2 || volumes.length < 2 || closes.length !== volumes.length) {
      return null;
    }

    // Calculate OBV values
    const obvValues: number[] = [volumes[0]]; // Start with first volume

    for (let i = 1; i < closes.length; i++) {
      const previousOBV = obvValues[i - 1];
      const priceChange = closes[i] - closes[i - 1];

      if (priceChange > 0) {
        obvValues.push(previousOBV + volumes[i]);
      } else if (priceChange < 0) {
        obvValues.push(previousOBV - volumes[i]);
      } else {
        obvValues.push(previousOBV);
      }
    }

    const currentOBV = obvValues[obvValues.length - 1];

    // Determine trend
    let trend: 'RISING' | 'FALLING' | 'FLAT' = 'FLAT';
    if (obvValues.length >= this.trendPeriod) {
      const recentOBV = obvValues.slice(-this.trendPeriod);
      const firstHalf = recentOBV.slice(0, Math.floor(this.trendPeriod / 2));
      const secondHalf = recentOBV.slice(Math.floor(this.trendPeriod / 2));

      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      if (secondAvg > firstAvg * 1.02) {
        trend = 'RISING';
      } else if (secondAvg < firstAvg * 0.98) {
        trend = 'FALLING';
      }
    }

    // Determine signal based on trend
    let signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (trend === 'RISING') {
      signal = 'BULLISH';
    } else if (trend === 'FALLING') {
      signal = 'BEARISH';
    } else {
      signal = 'NEUTRAL';
    }

    // Detect divergence
    const divergence = this.detectDivergence(
      closes.slice(-this.divergencePeriod),
      obvValues.slice(-this.divergencePeriod)
    );

    return {
      value: currentOBV,
      trend,
      signal,
      divergence,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate OBV series for all data points
   * @param closes Array of closing prices
   * @param volumes Array of volumes
   * @returns Array of OBV values
   */
  calculateSeries(closes: number[], volumes: number[]): number[] {
    if (closes.length < 1 || volumes.length < 1) {
      return [];
    }

    const obvValues: number[] = [volumes[0]];

    for (let i = 1; i < closes.length; i++) {
      const previousOBV = obvValues[i - 1];
      const priceChange = closes[i] - closes[i - 1];

      if (priceChange > 0) {
        obvValues.push(previousOBV + volumes[i]);
      } else if (priceChange < 0) {
        obvValues.push(previousOBV - volumes[i]);
      } else {
        obvValues.push(previousOBV);
      }
    }

    return obvValues;
  }

  /**
   * Detect OBV divergence from price
   * @param prices Recent closing prices
   * @param obvValues Corresponding OBV values
   * @returns Divergence type or null
   */
  detectDivergence(prices: number[], obvValues: number[]): 'BULLISH' | 'BEARISH' | null {
    if (prices.length < 4 || obvValues.length < 4) {
      return null;
    }

    // Find local highs and lows
    const priceHighs: number[] = [];
    const priceLows: number[] = [];
    const obvHighs: number[] = [];
    const obvLows: number[] = [];

    for (let i = 1; i < prices.length - 1; i++) {
      // Local high
      if (prices[i] > prices[i - 1] && prices[i] > prices[i + 1]) {
        priceHighs.push(prices[i]);
        obvHighs.push(obvValues[i]);
      }
      // Local low
      if (prices[i] < prices[i - 1] && prices[i] < prices[i + 1]) {
        priceLows.push(prices[i]);
        obvLows.push(obvValues[i]);
      }
    }

    // Bullish divergence: price making lower lows, OBV making higher lows
    if (priceLows.length >= 2 && obvLows.length >= 2) {
      const recentPriceLows = priceLows.slice(-2);
      const recentOBVLows = obvLows.slice(-2);

      if (recentPriceLows[1] < recentPriceLows[0] && recentOBVLows[1] > recentOBVLows[0]) {
        return 'BULLISH';
      }
    }

    // Bearish divergence: price making higher highs, OBV making lower highs
    if (priceHighs.length >= 2 && obvHighs.length >= 2) {
      const recentPriceHighs = priceHighs.slice(-2);
      const recentOBVHighs = obvHighs.slice(-2);

      if (recentPriceHighs[1] > recentPriceHighs[0] && recentOBVHighs[1] < recentOBVHighs[0]) {
        return 'BEARISH';
      }
    }

    return null;
  }

  /**
   * Calculate OBV momentum (rate of change)
   * @param obvValues Recent OBV values
   * @param period Period for momentum calculation
   * @returns Momentum value
   */
  calculateMomentum(obvValues: number[], period: number = 10): number | null {
    if (obvValues.length < period + 1) {
      return null;
    }

    const current = obvValues[obvValues.length - 1];
    const previous = obvValues[obvValues.length - 1 - period];

    return previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;
  }
}
