/**
 * MACD (Moving Average Convergence Divergence) Calculator
 *
 * MACD shows the relationship between two moving averages of prices.
 *
 * Components:
 * - MACD Line: 12-period EMA - 26-period EMA
 * - Signal Line: 9-period EMA of MACD Line
 * - Histogram: MACD Line - Signal Line
 *
 * Interpretation:
 * - MACD crosses above Signal: Bullish signal
 * - MACD crosses below Signal: Bearish signal
 * - Histogram > 0: Bullish momentum
 * - Histogram < 0: Bearish momentum
 */

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  crossover: 'BULLISH' | 'BEARISH' | 'NONE';
  strength: number; // 0-1 scale based on histogram magnitude
  timestamp: Date;
}

export interface MACDConfig {
  fastPeriod?: number; // Default: 12
  slowPeriod?: number; // Default: 26
  signalPeriod?: number; // Default: 9
}

export class MACDCalculator {
  private fastPeriod: number;
  private slowPeriod: number;
  private signalPeriod: number;

  constructor(config: MACDConfig = {}) {
    this.fastPeriod = config.fastPeriod ?? 12;
    this.slowPeriod = config.slowPeriod ?? 26;
    this.signalPeriod = config.signalPeriod ?? 9;
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   */
  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA is SMA
    const sma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(sma);

    // Calculate subsequent EMAs
    for (let i = period; i < prices.length; i++) {
      const currentEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(currentEMA);
    }

    return ema;
  }

  /**
   * Calculate MACD from price data
   * @param prices Array of closing prices (oldest first)
   * @returns MACD result or null if insufficient data
   */
  calculate(prices: number[], previousMACD?: number): MACDResult | null {
    const minLength = this.slowPeriod + this.signalPeriod;
    if (prices.length < minLength) {
      return null;
    }

    // Calculate fast and slow EMAs
    const fastEMA = this.calculateEMA(prices, this.fastPeriod);
    const slowEMA = this.calculateEMA(prices, this.slowPeriod);

    // Calculate MACD line (fast EMA - slow EMA)
    const macdLine: number[] = [];
    const offset = this.slowPeriod - this.fastPeriod;

    for (let i = 0; i < slowEMA.length; i++) {
      macdLine.push(fastEMA[i + offset] - slowEMA[i]);
    }

    // Calculate signal line (EMA of MACD line)
    const signalLine = this.calculateEMA(macdLine, this.signalPeriod);

    // Get latest values
    const macd = macdLine[macdLine.length - 1];
    const signal = signalLine[signalLine.length - 1];
    const histogram = macd - signal;

    // Detect crossover
    let crossover: 'BULLISH' | 'BEARISH' | 'NONE' = 'NONE';
    if (previousMACD !== undefined) {
      const previousHistogram = previousMACD - signal;
      if (previousHistogram <= 0 && histogram > 0) {
        crossover = 'BULLISH';
      } else if (previousHistogram >= 0 && histogram < 0) {
        crossover = 'BEARISH';
      }
    }

    // Calculate strength based on histogram magnitude
    const maxHistogram = Math.max(...macdLine.map((m, i) =>
      i >= this.signalPeriod - 1 ? Math.abs(m - signalLine[i - (this.signalPeriod - 1)]) : 0
    ));
    const strength = maxHistogram > 0 ? Math.min(Math.abs(histogram) / maxHistogram, 1) : 0;

    return {
      macd,
      signal,
      histogram,
      crossover,
      strength,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate MACD series for all data points
   * @param prices Array of closing prices
   * @returns Array of MACD results (null for insufficient data points)
   */
  calculateSeries(prices: number[]): (MACDResult | null)[] {
    const results: (MACDResult | null)[] = [];
    const minLength = this.slowPeriod + this.signalPeriod;

    for (let i = 0; i < prices.length; i++) {
      if (i < minLength - 1) {
        results.push(null);
        continue;
      }

      const slice = prices.slice(0, i + 1);
      const previousMACD = i > minLength - 1 && results[i - 1] ? results[i - 1]!.macd : undefined;
      const result = this.calculate(slice, previousMACD);
      results.push(result);
    }

    return results;
  }

  /**
   * Detect MACD divergence
   * @param prices Recent closing prices
   * @param macdValues Corresponding MACD histogram values
   * @returns Divergence type or null
   */
  detectDivergence(
    prices: number[],
    macdValues: number[]
  ): 'BULLISH' | 'BEARISH' | null {
    if (prices.length < 4 || macdValues.length < 4) {
      return null;
    }

    const recentPrices = prices.slice(-4);
    const recentMACD = macdValues.slice(-4);

    // Bullish divergence: price lower low, MACD higher low
    const priceLowerLow = recentPrices[3] < recentPrices[0];
    const macdHigherLow = recentMACD[3] > recentMACD[0];

    if (priceLowerLow && macdHigherLow) {
      return 'BULLISH';
    }

    // Bearish divergence: price higher high, MACD lower high
    const priceHigherHigh = recentPrices[3] > recentPrices[0];
    const macdLowerHigh = recentMACD[3] < recentMACD[0];

    if (priceHigherHigh && macdLowerHigh) {
      return 'BEARISH';
    }

    return null;
  }
}
