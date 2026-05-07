/**
 * Moving Averages Calculator
 *
 * Provides Simple Moving Average (SMA) and Exponential Moving Average (EMA)
 * calculations for trend analysis and signal generation.
 *
 * Common periods:
 * - Short-term: 10, 20
 * - Medium-term: 50
 * - Long-term: 100, 200
 *
 * Interpretation:
 * - Price above MA: Bullish trend
 * - Price below MA: Bearish trend
 * - Golden Cross: Short MA crosses above Long MA (bullish)
 * - Death Cross: Short MA crosses below Long MA (bearish)
 */

export interface MovingAverageResult {
  sma: number | null;
  ema: number | null;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  crossover: 'GOLDEN_CROSS' | 'DEATH_CROSS' | 'NONE';
  trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  timestamp: Date;
}

export interface MovingAverageConfig {
  shortPeriod?: number; // Default: 50
  longPeriod?: number; // Default: 200
  calculateSMA?: boolean; // Default: true
  calculateEMA?: boolean; // Default: true
}

export class MovingAverageCalculator {
  private shortPeriod: number;
  private longPeriod: number;
  private calculateSMAFlag: boolean;
  private calculateEMAFlag: boolean;

  constructor(config: MovingAverageConfig = {}) {
    this.shortPeriod = config.shortPeriod ?? 50;
    this.longPeriod = config.longPeriod ?? 200;
    this.calculateSMAFlag = config.calculateSMA ?? true;
    this.calculateEMAFlag = config.calculateEMA ?? true;
  }

  /**
   * Calculate Simple Moving Average
   */
  calculateSMA(prices: number[], period: number): number | null {
    if (prices.length < period) {
      return null;
    }

    const relevantPrices = prices.slice(-period);
    const sum = relevantPrices.reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * Calculate SMA series for all data points
   */
  calculateSMASeries(prices: number[], period: number): number[] {
    const smaValues: number[] = [];

    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      smaValues.push(sum / period);
    }

    return smaValues;
  }

  /**
   * Calculate Exponential Moving Average
   */
  calculateEMA(prices: number[], period: number): number | null {
    if (prices.length < period) {
      return null;
    }

    const emaValues = this.calculateEMASeries(prices, period);
    return emaValues.length > 0 ? emaValues[emaValues.length - 1] : null;
  }

  /**
   * Calculate EMA series for all data points
   */
  calculateEMASeries(prices: number[], period: number): number[] {
    if (prices.length < period) {
      return [];
    }

    const emaValues: number[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA is SMA
    const initialSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    emaValues.push(initialSMA);

    // Calculate subsequent EMAs
    for (let i = period; i < prices.length; i++) {
      const currentEMA = (prices[i] - emaValues[emaValues.length - 1]) * multiplier + emaValues[emaValues.length - 1];
      emaValues.push(currentEMA);
    }

    return emaValues;
  }

  /**
   * Calculate moving averages with signals
   */
  calculate(prices: number[]): MovingAverageResult | null {
    if (prices.length < this.longPeriod) {
      return null;
    }

    const currentPrice = prices[prices.length - 1];

    // Calculate short and long period averages
    const shortSMA = this.calculateSMAFlag ? this.calculateSMA(prices, this.shortPeriod) : null;
    const longSMA = this.calculateSMAFlag ? this.calculateSMA(prices, this.longPeriod) : null;
    const shortEMA = this.calculateEMAFlag ? this.calculateEMA(prices, this.shortPeriod) : null;
    const longEMA = this.calculateEMAFlag ? this.calculateEMA(prices, this.longPeriod) : null;

    // Use SMA for analysis if available, otherwise EMA
    const shortMA = shortSMA ?? shortEMA;
    const longMA = longSMA ?? longEMA;

    if (!shortMA || !longMA) {
      return null;
    }

    // Determine trend based on price position relative to MAs
    let trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
    if (currentPrice > shortMA && currentPrice > longMA && shortMA > longMA) {
      trend = 'UPTREND';
    } else if (currentPrice < shortMA && currentPrice < longMA && shortMA < longMA) {
      trend = 'DOWNTREND';
    } else {
      trend = 'SIDEWAYS';
    }

    // Determine signal based on price position
    let signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (currentPrice > shortMA && shortMA > longMA) {
      signal = 'BULLISH';
    } else if (currentPrice < shortMA && shortMA < longMA) {
      signal = 'BEARISH';
    } else {
      signal = 'NEUTRAL';
    }

    // Detect crossovers
    const crossover = this.detectCrossover(prices);

    return {
      sma: shortSMA,
      ema: shortEMA,
      signal,
      crossover,
      trend,
      timestamp: new Date(),
    };
  }

  /**
   * Detect Golden Cross or Death Cross
   */
  private detectCrossover(prices: number[]): 'GOLDEN_CROSS' | 'DEATH_CROSS' | 'NONE' {
    if (prices.length < this.longPeriod + 1) {
      return 'NONE';
    }

    // Calculate current and previous MAs
    const currentShortMA = this.calculateSMA(prices, this.shortPeriod);
    const currentLongMA = this.calculateSMA(prices, this.longPeriod);
    const previousShortMA = this.calculateSMA(prices.slice(0, -1), this.shortPeriod);
    const previousLongMA = this.calculateSMA(prices.slice(0, -1), this.longPeriod);

    if (!currentShortMA || !currentLongMA || !previousShortMA || !previousLongMA) {
      return 'NONE';
    }

    // Golden Cross: Short MA crosses above Long MA
    if (previousShortMA <= previousLongMA && currentShortMA > currentLongMA) {
      return 'GOLDEN_CROSS';
    }

    // Death Cross: Short MA crosses below Long MA
    if (previousShortMA >= previousLongMA && currentShortMA < currentLongMA) {
      return 'DEATH_CROSS';
    }

    return 'NONE';
  }

  /**
   * Calculate distance between price and MA (as percentage)
   */
  calculateDistanceFromMA(price: number, ma: number): number {
    return ((price - ma) / ma) * 100;
  }

  /**
   * Determine if MAs are converging or diverging
   */
  calculateMADivergence(prices: number[], lookback: number = 10): 'CONVERGING' | 'DIVERGING' | 'STABLE' {
    if (prices.length < this.longPeriod + lookback) {
      return 'STABLE';
    }

    const recentDistances: number[] = [];

    for (let i = prices.length - lookback; i < prices.length; i++) {
      const shortMA = this.calculateSMA(prices.slice(0, i + 1), this.shortPeriod);
      const longMA = this.calculateSMA(prices.slice(0, i + 1), this.longPeriod);

      if (shortMA && longMA) {
        recentDistances.push(Math.abs(shortMA - longMA));
      }
    }

    if (recentDistances.length < 2) {
      return 'STABLE';
    }

    const firstHalf = recentDistances.slice(0, Math.floor(recentDistances.length / 2));
    const secondHalf = recentDistances.slice(Math.floor(recentDistances.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (secondAvg < firstAvg * 0.95) {
      return 'CONVERGING';
    } else if (secondAvg > firstAvg * 1.05) {
      return 'DIVERGING';
    }

    return 'STABLE';
  }
}
