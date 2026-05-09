/**
 * Stochastic Oscillator Calculator
 *
 * The Stochastic Oscillator compares a closing price to its price range
 * over a given time period to identify overbought/oversold conditions.
 *
 * Components:
 * - %K Line: (Current Close - Lowest Low) / (Highest High - Lowest Low) * 100
 * - %D Line: 3-period SMA of %K
 *
 * Interpretation:
 * - %K > 80: Overbought
 * - %K < 20: Oversold
 * - %K crosses above %D: Bullish signal
 * - %K crosses below %D: Bearish signal
 */

export interface StochasticResult {
  k: number; // %K value (0-100)
  d: number; // %D value (0-100)
  signal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
  crossover: 'BULLISH' | 'BEARISH' | 'NONE';
  strength: number; // 0-1 scale
  timestamp: Date;
}

export interface StochasticConfig {
  kPeriod?: number; // Default: 14
  dPeriod?: number; // Default: 3
  overboughtThreshold?: number; // Default: 80
  oversoldThreshold?: number; // Default: 20
}

export class StochasticCalculator {
  private kPeriod: number;
  private dPeriod: number;
  private overboughtThreshold: number;
  private oversoldThreshold: number;

  constructor(config: StochasticConfig = {}) {
    this.kPeriod = config.kPeriod ?? 14;
    this.dPeriod = config.dPeriod ?? 3;
    this.overboughtThreshold = config.overboughtThreshold ?? 80;
    this.oversoldThreshold = config.oversoldThreshold ?? 20;
  }

  /**
   * Calculate %K value
   */
  private calculateK(
    currentClose: number,
    highestHigh: number,
    lowestLow: number
  ): number {
    const range = highestHigh - lowestLow;
    if (range === 0) return 50; // Neutral if no range
    return ((currentClose - lowestLow) / range) * 100;
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate Stochastic Oscillator from OHLC data
   * @param highs Array of high prices
   * @param lows Array of low prices
   * @param closes Array of closing prices
   * @param previousK Previous %K value for crossover detection
   * @returns Stochastic result or null if insufficient data
   */
  calculate(
    highs: number[],
    lows: number[],
    closes: number[],
    previousK?: number
  ): StochasticResult | null {
    const minLength = this.kPeriod + this.dPeriod - 1;
    if (highs.length < minLength || lows.length < minLength || closes.length < minLength) {
      return null;
    }

    // Calculate %K values for the last kPeriod + dPeriod - 1 periods
    const kValues: number[] = [];
    const startIndex = Math.max(0, closes.length - this.kPeriod - this.dPeriod + 1);

    for (let i = startIndex; i < closes.length; i++) {
      const periodStart = Math.max(0, i - this.kPeriod + 1);
      const periodHighs = highs.slice(periodStart, i + 1);
      const periodLows = lows.slice(periodStart, i + 1);

      const highestHigh = Math.max(...periodHighs);
      const lowestLow = Math.min(...periodLows);
      const k = this.calculateK(closes[i], highestHigh, lowestLow);

      kValues.push(k);
    }

    // Get current %K
    const k = kValues[kValues.length - 1];

    // Calculate %D (SMA of %K)
    const dValues = kValues.slice(-this.dPeriod);
    const d = this.calculateSMA(dValues);

    // Determine signal
    let signal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
    let strength: number;

    if (k >= this.overboughtThreshold) {
      signal = 'OVERBOUGHT';
      strength = Math.min((k - this.overboughtThreshold) / (100 - this.overboughtThreshold), 1);
    } else if (k <= this.oversoldThreshold) {
      signal = 'OVERSOLD';
      strength = Math.min((this.oversoldThreshold - k) / this.oversoldThreshold, 1);
    } else {
      signal = 'NEUTRAL';
      strength = 0;
    }

    // Detect crossover
    let crossover: 'BULLISH' | 'BEARISH' | 'NONE' = 'NONE';
    if (previousK !== undefined) {
      const previousD = kValues.length >= this.dPeriod + 1
        ? this.calculateSMA(kValues.slice(-this.dPeriod - 1, -1))
        : d;

      if (previousK <= previousD && k > d) {
        crossover = 'BULLISH';
      } else if (previousK >= previousD && k < d) {
        crossover = 'BEARISH';
      }
    }

    return {
      k,
      d,
      signal,
      crossover,
      strength,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate Stochastic series for all data points
   * @param highs Array of high prices
   * @param lows Array of low prices
   * @param closes Array of closing prices
   * @returns Array of Stochastic results (null for insufficient data points)
   */
  calculateSeries(
    highs: number[],
    lows: number[],
    closes: number[]
  ): (StochasticResult | null)[] {
    const results: (StochasticResult | null)[] = [];
    const minLength = this.kPeriod + this.dPeriod - 1;

    for (let i = 0; i < closes.length; i++) {
      if (i < minLength - 1) {
        results.push(null);
        continue;
      }

      const highSlice = highs.slice(0, i + 1);
      const lowSlice = lows.slice(0, i + 1);
      const closeSlice = closes.slice(0, i + 1);
      const previousK = i > minLength - 1 && results[i - 1] ? results[i - 1]!.k : undefined;

      const result = this.calculate(highSlice, lowSlice, closeSlice, previousK);
      results.push(result);
    }

    return results;
  }

  /**
   * Detect Stochastic divergence
   * @param closes Recent closing prices
   * @param kValues Corresponding %K values
   * @returns Divergence type or null
   */
  detectDivergence(
    closes: number[],
    kValues: number[]
  ): 'BULLISH' | 'BEARISH' | null {
    if (closes.length < 4 || kValues.length < 4) {
      return null;
    }

    const recentCloses = closes.slice(-4);
    const recentK = kValues.slice(-4);

    // Bullish divergence: price lower low, %K higher low
    const priceLowerLow = recentCloses[3] < recentCloses[0];
    const kHigherLow = recentK[3] > recentK[0];
    const kAnyOversold = recentK.some(k => k <= this.oversoldThreshold);

    if (priceLowerLow && kHigherLow && kAnyOversold) {
      return 'BULLISH';
    }

    // Bearish divergence: price higher high, %K lower high
    const priceHigherHigh = recentCloses[3] > recentCloses[0];
    const kLowerHigh = recentK[3] < recentK[0];
    const kAnyOverbought = recentK.some(k => k >= this.overboughtThreshold);

    if (priceHigherHigh && kLowerHigh && kAnyOverbought) {
      return 'BEARISH';
    }

    return null;
  }
}
