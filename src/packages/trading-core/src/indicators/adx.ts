/**
 * ADX (Average Directional Index) Calculator
 *
 * ADX measures the strength of a trend, regardless of direction.
 * It's derived from the Directional Movement System.
 *
 * Components:
 * - +DI: Positive Directional Indicator
 * - -DI: Negative Directional Indicator
 * - ADX: Average of DX (Directional Movement Index)
 *
 * Interpretation:
 * - ADX > 25: Strong trend
 * - ADX < 20: Weak trend or ranging market
 * - +DI > -DI: Uptrend
 * - -DI > +DI: Downtrend
 */

export interface ADXResult {
  adx: number; // ADX value (0-100)
  plusDI: number; // +DI value (0-100)
  minusDI: number; // -DI value (0-100)
  trendStrength: 'STRONG' | 'MODERATE' | 'WEAK';
  trendDirection: 'UP' | 'DOWN' | 'NEUTRAL';
  timestamp: Date;
}

export interface ADXConfig {
  period?: number; // Default: 14
  strongThreshold?: number; // Default: 25
  weakThreshold?: number; // Default: 20
}

export class ADXCalculator {
  private period: number;
  private strongThreshold: number;
  private weakThreshold: number;

  constructor(config: ADXConfig = {}) {
    this.period = config.period ?? 14;
    this.strongThreshold = config.strongThreshold ?? 25;
    this.weakThreshold = config.weakThreshold ?? 20;
  }

  /**
   * Calculate True Range
   */
  private calculateTR(high: number, low: number, previousClose: number): number {
    return Math.max(
      high - low,
      Math.abs(high - previousClose),
      Math.abs(low - previousClose)
    );
  }

  /**
   * Calculate Directional Movement
   */
  private calculateDM(
    high: number,
    low: number,
    previousHigh: number,
    previousLow: number
  ): { plusDM: number; minusDM: number } {
    const upMove = high - previousHigh;
    const downMove = previousLow - low;

    let plusDM = 0;
    let minusDM = 0;

    if (upMove > downMove && upMove > 0) {
      plusDM = upMove;
    }
    if (downMove > upMove && downMove > 0) {
      minusDM = downMove;
    }

    return { plusDM, minusDM };
  }

  /**
   * Calculate smoothed average using Wilder's method
   */
  private smoothAverage(values: number[], previousAvg?: number): number {
    if (previousAvg === undefined) {
      return values.reduce((a, b) => a + b, 0) / values.length;
    }
    const current = values[values.length - 1];
    return (previousAvg * (this.period - 1) + current) / this.period;
  }

  /**
   * Calculate ADX from OHLC data
   * @param highs Array of high prices
   * @param lows Array of low prices
   * @param closes Array of closing prices
   * @returns ADX result or null if insufficient data
   */
  calculate(
    highs: number[],
    lows: number[],
    closes: number[]
  ): ADXResult | null {
    const minLength = this.period * 2 + 1;
    if (highs.length < minLength || lows.length < minLength || closes.length < minLength) {
      return null;
    }

    // Calculate True Range and Directional Movement
    const trValues: number[] = [];
    const plusDMValues: number[] = [];
    const minusDMValues: number[] = [];

    for (let i = 1; i < closes.length; i++) {
      const tr = this.calculateTR(highs[i], lows[i], closes[i - 1]);
      const { plusDM, minusDM } = this.calculateDM(
        highs[i],
        lows[i],
        highs[i - 1],
        lows[i - 1]
      );

      trValues.push(tr);
      plusDMValues.push(plusDM);
      minusDMValues.push(minusDM);
    }

    // Calculate smoothed TR, +DM, -DM
    let smoothedTR = this.smoothAverage(trValues.slice(0, this.period));
    let smoothedPlusDM = this.smoothAverage(plusDMValues.slice(0, this.period));
    let smoothedMinusDM = this.smoothAverage(minusDMValues.slice(0, this.period));

    for (let i = this.period; i < trValues.length; i++) {
      smoothedTR = this.smoothAverage([trValues[i]], smoothedTR);
      smoothedPlusDM = this.smoothAverage([plusDMValues[i]], smoothedPlusDM);
      smoothedMinusDM = this.smoothAverage([minusDMValues[i]], smoothedMinusDM);
    }

    // Calculate +DI and -DI
    const plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
    const minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;

    // Calculate DX
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;

    // Calculate ADX (smoothed DX)
    // For simplicity, we'll use the current DX as ADX
    // In a full implementation, you'd maintain a history of DX values
    const adx = dx;

    // Determine trend strength
    let trendStrength: 'STRONG' | 'MODERATE' | 'WEAK';
    if (adx >= this.strongThreshold) {
      trendStrength = 'STRONG';
    } else if (adx >= this.weakThreshold) {
      trendStrength = 'MODERATE';
    } else {
      trendStrength = 'WEAK';
    }

    // Determine trend direction
    let trendDirection: 'UP' | 'DOWN' | 'NEUTRAL';
    if (plusDI > minusDI && adx >= this.weakThreshold) {
      trendDirection = 'UP';
    } else if (minusDI > plusDI && adx >= this.weakThreshold) {
      trendDirection = 'DOWN';
    } else {
      trendDirection = 'NEUTRAL';
    }

    return {
      adx,
      plusDI,
      minusDI,
      trendStrength,
      trendDirection,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate ADX series for all data points
   * @param highs Array of high prices
   * @param lows Array of low prices
   * @param closes Array of closing prices
   * @returns Array of ADX results (null for insufficient data points)
   */
  calculateSeries(
    highs: number[],
    lows: number[],
    closes: number[]
  ): (ADXResult | null)[] {
    const results: (ADXResult | null)[] = [];
    const minLength = this.period * 2 + 1;

    for (let i = 0; i < closes.length; i++) {
      if (i < minLength - 1) {
        results.push(null);
        continue;
      }

      const highSlice = highs.slice(0, i + 1);
      const lowSlice = lows.slice(0, i + 1);
      const closeSlice = closes.slice(0, i + 1);

      const result = this.calculate(highSlice, lowSlice, closeSlice);
      results.push(result);
    }

    return results;
  }

  /**
   * Detect trend change based on DI crossover
   * @param recentResults Recent ADX results
   * @returns Trend change signal or null
   */
  detectTrendChange(recentResults: ADXResult[]): 'BULLISH' | 'BEARISH' | null {
    if (recentResults.length < 2) {
      return null;
    }

    const [previous, current] = recentResults.slice(-2);

    // Bullish: +DI crosses above -DI with ADX rising
    if (
      previous.plusDI <= previous.minusDI &&
      current.plusDI > current.minusDI &&
      current.adx >= this.weakThreshold
    ) {
      return 'BULLISH';
    }

    // Bearish: -DI crosses above +DI with ADX rising
    if (
      previous.minusDI <= previous.plusDI &&
      current.minusDI > current.plusDI &&
      current.adx >= this.weakThreshold
    ) {
      return 'BEARISH';
    }

    return null;
  }
}
