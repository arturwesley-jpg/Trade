/**
 * ATR (Average True Range) Calculator
 *
 * ATR measures market volatility by calculating the average of true ranges
 * over a specified period. It doesn't indicate price direction, only volatility.
 *
 * True Range is the greatest of:
 * - Current High - Current Low
 * - |Current High - Previous Close|
 * - |Current Low - Previous Close|
 *
 * Interpretation:
 * - High ATR: High volatility, wider stops recommended
 * - Low ATR: Low volatility, tighter stops possible
 * - Rising ATR: Increasing volatility
 * - Falling ATR: Decreasing volatility
 */

export interface ATRResult {
  value: number;
  percentOfPrice: number; // ATR as percentage of current price
  volatility: 'HIGH' | 'MODERATE' | 'LOW';
  trend: 'RISING' | 'FALLING' | 'STABLE';
  timestamp: Date;
}

export interface ATRConfig {
  period?: number; // Default: 14
  highVolatilityThreshold?: number; // Default: 3% of price
  lowVolatilityThreshold?: number; // Default: 1% of price
}

export class ATRCalculator {
  private period: number;
  private highVolatilityThreshold: number;
  private lowVolatilityThreshold: number;

  constructor(config: ATRConfig = {}) {
    this.period = config.period ?? 14;
    this.highVolatilityThreshold = config.highVolatilityThreshold ?? 0.03;
    this.lowVolatilityThreshold = config.lowVolatilityThreshold ?? 0.01;
  }

  /**
   * Calculate True Range for a single period
   */
  private calculateTR(high: number, low: number, previousClose: number): number {
    return Math.max(
      high - low,
      Math.abs(high - previousClose),
      Math.abs(low - previousClose)
    );
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
   * Calculate ATR from OHLC data
   * @param highs Array of high prices
   * @param lows Array of low prices
   * @param closes Array of closing prices
   * @returns ATR result or null if insufficient data
   */
  calculate(
    highs: number[],
    lows: number[],
    closes: number[]
  ): ATRResult | null {
    if (highs.length < this.period + 1 || lows.length < this.period + 1 || closes.length < this.period + 1) {
      return null;
    }

    // Calculate True Range values
    const trValues: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const tr = this.calculateTR(highs[i], lows[i], closes[i - 1]);
      trValues.push(tr);
    }

    // Calculate initial ATR (simple average of first period TRs)
    let atr = this.smoothAverage(trValues.slice(0, this.period));

    // Apply Wilder's smoothing for remaining values
    for (let i = this.period; i < trValues.length; i++) {
      atr = this.smoothAverage([trValues[i]], atr);
    }

    const currentPrice = closes[closes.length - 1];
    const percentOfPrice = (atr / currentPrice) * 100;

    // Determine volatility level
    let volatility: 'HIGH' | 'MODERATE' | 'LOW';
    if (percentOfPrice >= this.highVolatilityThreshold * 100) {
      volatility = 'HIGH';
    } else if (percentOfPrice >= this.lowVolatilityThreshold * 100) {
      volatility = 'MODERATE';
    } else {
      volatility = 'LOW';
    }

    // Determine trend (compare recent ATR to older ATR)
    let trend: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';
    if (trValues.length >= this.period * 2) {
      const olderTRs = trValues.slice(-this.period * 2, -this.period);
      const olderATR = this.smoothAverage(olderTRs);

      if (atr > olderATR * 1.1) {
        trend = 'RISING';
      } else if (atr < olderATR * 0.9) {
        trend = 'FALLING';
      }
    }

    return {
      value: atr,
      percentOfPrice,
      volatility,
      trend,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate ATR series for all data points
   * @param highs Array of high prices
   * @param lows Array of low prices
   * @param closes Array of closing prices
   * @returns Array of ATR values (null for insufficient data points)
   */
  calculateSeries(
    highs: number[],
    lows: number[],
    closes: number[]
  ): (number | null)[] {
    const results: (number | null)[] = [];

    for (let i = 0; i < closes.length; i++) {
      if (i < this.period) {
        results.push(null);
        continue;
      }

      const highSlice = highs.slice(0, i + 1);
      const lowSlice = lows.slice(0, i + 1);
      const closeSlice = closes.slice(0, i + 1);

      const result = this.calculate(highSlice, lowSlice, closeSlice);
      results.push(result ? result.value : null);
    }

    return results;
  }

  /**
   * Calculate position size based on ATR
   * @param accountBalance Total account balance
   * @param riskPercent Risk percentage per trade (e.g., 1 for 1%)
   * @param atr Current ATR value
   * @param entryPrice Entry price
   * @param stopLossMultiplier ATR multiplier for stop loss (default: 2)
   * @returns Recommended position size
   */
  calculatePositionSize(
    accountBalance: number,
    riskPercent: number,
    atr: number,
    entryPrice: number,
    stopLossMultiplier: number = 2
  ): {
    positionSize: number;
    stopLossDistance: number;
    stopLossPrice: number;
  } {
    const riskAmount = accountBalance * (riskPercent / 100);
    const stopLossDistance = atr * stopLossMultiplier;
    const positionSize = riskAmount / stopLossDistance;
    const stopLossPrice = entryPrice - stopLossDistance;

    return {
      positionSize,
      stopLossDistance,
      stopLossPrice,
    };
  }

  /**
   * Calculate dynamic stop loss based on ATR
   * @param entryPrice Entry price
   * @param atr Current ATR value
   * @param multiplier ATR multiplier (default: 2)
   * @param side Position side (LONG or SHORT)
   * @returns Stop loss price
   */
  calculateStopLoss(
    entryPrice: number,
    atr: number,
    multiplier: number = 2,
    side: 'LONG' | 'SHORT' = 'LONG'
  ): number {
    const distance = atr * multiplier;
    return side === 'LONG' ? entryPrice - distance : entryPrice + distance;
  }

  /**
   * Calculate dynamic take profit based on ATR
   * @param entryPrice Entry price
   * @param atr Current ATR value
   * @param multiplier ATR multiplier (default: 3)
   * @param side Position side (LONG or SHORT)
   * @returns Take profit price
   */
  calculateTakeProfit(
    entryPrice: number,
    atr: number,
    multiplier: number = 3,
    side: 'LONG' | 'SHORT' = 'LONG'
  ): number {
    const distance = atr * multiplier;
    return side === 'LONG' ? entryPrice + distance : entryPrice - distance;
  }
}
