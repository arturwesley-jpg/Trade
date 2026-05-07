/**
 * RSI (Relative Strength Index) Calculator
 *
 * RSI measures the magnitude of recent price changes to evaluate
 * overbought or oversold conditions in the price of an asset.
 *
 * Formula:
 * RSI = 100 - (100 / (1 + RS))
 * where RS = Average Gain / Average Loss
 *
 * Interpretation:
 * - RSI > 70: Overbought (potential sell signal)
 * - RSI < 30: Oversold (potential buy signal)
 * - RSI = 50: Neutral
 */

export interface RSIResult {
  value: number;
  signal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
  strength: number; // 0-1 scale
  timestamp: Date;
}

export interface RSIConfig {
  period?: number; // Default: 14
  overboughtThreshold?: number; // Default: 70
  oversoldThreshold?: number; // Default: 30
}

export class RSICalculator {
  private period: number;
  private overboughtThreshold: number;
  private oversoldThreshold: number;

  constructor(config: RSIConfig = {}) {
    this.period = config.period ?? 14;
    this.overboughtThreshold = config.overboughtThreshold ?? 70;
    this.oversoldThreshold = config.oversoldThreshold ?? 30;
  }

  /**
   * Calculate RSI from price data
   * @param prices Array of closing prices (oldest first)
   * @returns RSI result or null if insufficient data
   */
  calculate(prices: number[]): RSIResult | null {
    if (prices.length < this.period + 1) {
      return null;
    }

    // Calculate price changes
    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    // Separate gains and losses
    const gains = changes.map(change => (change > 0 ? change : 0));
    const losses = changes.map(change => (change < 0 ? Math.abs(change) : 0));

    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, this.period).reduce((a, b) => a + b, 0) / this.period;
    let avgLoss = losses.slice(0, this.period).reduce((a, b) => a + b, 0) / this.period;

    // Use Wilder's smoothing method for subsequent values
    for (let i = this.period; i < changes.length; i++) {
      avgGain = (avgGain * (this.period - 1) + gains[i]) / this.period;
      avgLoss = (avgLoss * (this.period - 1) + losses[i]) / this.period;
    }

    // Calculate RS and RSI
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    // Determine signal
    let signal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
    let strength: number;

    if (rsi >= this.overboughtThreshold) {
      signal = 'OVERBOUGHT';
      strength = Math.min((rsi - this.overboughtThreshold) / (100 - this.overboughtThreshold), 1);
    } else if (rsi <= this.oversoldThreshold) {
      signal = 'OVERSOLD';
      strength = Math.min((this.oversoldThreshold - rsi) / this.oversoldThreshold, 1);
    } else {
      signal = 'NEUTRAL';
      strength = 0;
    }

    return {
      value: rsi,
      signal,
      strength,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate RSI series for all data points
   * @param prices Array of closing prices
   * @returns Array of RSI values (null for insufficient data points)
   */
  calculateSeries(prices: number[]): (number | null)[] {
    const results: (number | null)[] = [];

    for (let i = 0; i < prices.length; i++) {
      if (i < this.period) {
        results.push(null);
        continue;
      }

      const slice = prices.slice(0, i + 1);
      const result = this.calculate(slice);
      results.push(result ? result.value : null);
    }

    return results;
  }

  /**
   * Detect RSI divergence (price vs RSI trend mismatch)
   * @param prices Recent closing prices
   * @param rsiValues Corresponding RSI values
   * @returns Divergence type or null
   */
  detectDivergence(
    prices: number[],
    rsiValues: number[]
  ): 'BULLISH' | 'BEARISH' | null {
    if (prices.length < 4 || rsiValues.length < 4) {
      return null;
    }

    const recentPrices = prices.slice(-4);
    const recentRSI = rsiValues.slice(-4);

    // Check for bullish divergence (price making lower lows, RSI making higher lows)
    const priceLowerLow = recentPrices[3] < recentPrices[0];
    const rsiHigherLow = recentRSI[3] > recentRSI[0];

    if (priceLowerLow && rsiHigherLow) {
      return 'BULLISH';
    }

    // Check for bearish divergence (price making higher highs, RSI making lower highs)
    const priceHigherHigh = recentPrices[3] > recentPrices[0];
    const rsiLowerHigh = recentRSI[3] < recentRSI[0];

    if (priceHigherHigh && rsiLowerHigh) {
      return 'BEARISH';
    }

    return null;
  }
}
