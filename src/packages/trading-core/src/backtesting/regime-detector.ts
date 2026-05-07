import type { Candle } from "../intelligence-engines.js";

export type MarketRegime = "trending_up" | "trending_down" | "ranging" | "volatile";

export interface RegimeDetectionResult {
  regime: MarketRegime;
  confidence: number;
  adx: number;
  atr: number;
  bbWidth: number;
  timestamp: number;
}

export interface RegimeIndicators {
  adx: number;
  atr: number;
  atrPct: number;
  bbWidth: number;
  bbWidthPct: number;
  sma20: number;
  sma50: number;
  priceVsSma20: number;
  priceVsSma50: number;
}

export class RegimeDetector {
  /**
   * Detect market regime for a given candle using technical indicators
   */
  detectRegime(candles: Candle[], currentIndex: number): RegimeDetectionResult {
    if (currentIndex < 50) {
      // Not enough data for reliable detection
      return {
        regime: "ranging",
        confidence: 0.5,
        adx: 0,
        atr: 0,
        bbWidth: 0,
        timestamp: candles[currentIndex].timestamp
      };
    }

    const indicators = this.calculateIndicators(candles, currentIndex);
    const regime = this.classifyRegime(indicators);

    return {
      ...regime,
      timestamp: candles[currentIndex].timestamp
    };
  }

  /**
   * Detect regime for all candles in a dataset
   */
  detectRegimes(candles: Candle[]): RegimeDetectionResult[] {
    const results: RegimeDetectionResult[] = [];

    for (let i = 0; i < candles.length; i++) {
      results.push(this.detectRegime(candles, i));
    }

    return results;
  }

  /**
   * Calculate technical indicators for regime detection
   */
  private calculateIndicators(candles: Candle[], currentIndex: number): RegimeIndicators {
    const lookback = Math.min(50, currentIndex + 1);
    const recentCandles = candles.slice(currentIndex - lookback + 1, currentIndex + 1);

    // Calculate ADX (Average Directional Index)
    const adx = this.calculateADX(recentCandles);

    // Calculate ATR (Average True Range)
    const atr = this.calculateATR(recentCandles);
    const currentPrice = recentCandles[recentCandles.length - 1].close;
    const atrPct = (atr / currentPrice) * 100;

    // Calculate Bollinger Band Width
    const { width: bbWidth, widthPct: bbWidthPct } = this.calculateBollingerBandWidth(recentCandles);

    // Calculate SMAs
    const sma20 = this.calculateSMA(recentCandles, 20);
    const sma50 = this.calculateSMA(recentCandles, 50);

    // Price position relative to SMAs
    const priceVsSma20 = ((currentPrice - sma20) / sma20) * 100;
    const priceVsSma50 = ((currentPrice - sma50) / sma50) * 100;

    return {
      adx,
      atr,
      atrPct,
      bbWidth,
      bbWidthPct,
      sma20,
      sma50,
      priceVsSma20,
      priceVsSma50
    };
  }

  /**
   * Classify market regime based on indicators
   */
  private classifyRegime(indicators: RegimeIndicators): {
    regime: MarketRegime;
    confidence: number;
    adx: number;
    atr: number;
    bbWidth: number;
  } {
    const { adx, atrPct, bbWidthPct, priceVsSma20, priceVsSma50 } = indicators;

    // High volatility regime
    if (atrPct > 5 || bbWidthPct > 10) {
      return {
        regime: "volatile",
        confidence: Math.min(0.9, 0.5 + (atrPct / 10)),
        adx: indicators.adx,
        atr: indicators.atr,
        bbWidth: indicators.bbWidth
      };
    }

    // Trending regime (ADX > 25 indicates strong trend)
    if (adx > 25) {
      // Determine trend direction
      const isTrendingUp = priceVsSma20 > 0 && priceVsSma50 > 0;
      const isTrendingDown = priceVsSma20 < 0 && priceVsSma50 < 0;

      if (isTrendingUp) {
        return {
          regime: "trending_up",
          confidence: Math.min(0.95, 0.6 + (adx / 100)),
          adx: indicators.adx,
          atr: indicators.atr,
          bbWidth: indicators.bbWidth
        };
      } else if (isTrendingDown) {
        return {
          regime: "trending_down",
          confidence: Math.min(0.95, 0.6 + (adx / 100)),
          adx: indicators.adx,
          atr: indicators.atr,
          bbWidth: indicators.bbWidth
        };
      }
    }

    // Ranging regime (low ADX, low volatility)
    return {
      regime: "ranging",
      confidence: Math.min(0.9, 0.6 + ((25 - adx) / 50)),
      adx: indicators.adx,
      atr: indicators.atr,
      bbWidth: indicators.bbWidth
    };
  }

  /**
   * Calculate ADX (Average Directional Index)
   */
  private calculateADX(candles: Candle[], period: number = 14): number {
    if (candles.length < period + 1) return 0;

    const trueRanges: number[] = [];
    const plusDMs: number[] = [];
    const minusDMs: number[] = [];

    // Calculate True Range, +DM, -DM
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      const prevHigh = candles[i - 1].high;
      const prevLow = candles[i - 1].low;

      // True Range
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);

      // Directional Movement
      const highDiff = high - prevHigh;
      const lowDiff = prevLow - low;

      const plusDM = highDiff > lowDiff && highDiff > 0 ? highDiff : 0;
      const minusDM = lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0;

      plusDMs.push(plusDM);
      minusDMs.push(minusDM);
    }

    if (trueRanges.length < period) return 0;

    // Calculate smoothed TR, +DM, -DM
    const smoothedTR = this.smoothedAverage(trueRanges, period);
    const smoothedPlusDM = this.smoothedAverage(plusDMs, period);
    const smoothedMinusDM = this.smoothedAverage(minusDMs, period);

    // Calculate +DI and -DI
    const plusDI = (smoothedPlusDM / smoothedTR) * 100;
    const minusDI = (smoothedMinusDM / smoothedTR) * 100;

    // Calculate DX
    const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;

    return dx;
  }

  /**
   * Calculate ATR (Average True Range)
   */
  private calculateATR(candles: Candle[], period: number = 14): number {
    if (candles.length < period + 1) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    return this.smoothedAverage(trueRanges, period);
  }

  /**
   * Calculate Bollinger Band Width
   */
  private calculateBollingerBandWidth(
    candles: Candle[],
    period: number = 20,
    stdDevMultiplier: number = 2
  ): { width: number; widthPct: number } {
    if (candles.length < period) return { width: 0, widthPct: 0 };

    const closes = candles.map(c => c.close);
    const sma = this.calculateSMA(candles, period);
    const stdDev = this.calculateStdDev(closes.slice(-period), sma);

    const upperBand = sma + stdDevMultiplier * stdDev;
    const lowerBand = sma - stdDevMultiplier * stdDev;

    const width = upperBand - lowerBand;
    const widthPct = (width / sma) * 100;

    return { width, widthPct };
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(candles: Candle[], period: number): number {
    if (candles.length < period) return candles[candles.length - 1].close;

    const closes = candles.slice(-period).map(c => c.close);
    return closes.reduce((sum, val) => sum + val, 0) / period;
  }

  /**
   * Calculate Standard Deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;

    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate smoothed average (Wilder's smoothing)
   */
  private smoothedAverage(values: number[], period: number): number {
    if (values.length < period) return 0;

    // Initial SMA
    let smoothed = values.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

    // Apply Wilder's smoothing
    for (let i = period; i < values.length; i++) {
      smoothed = (smoothed * (period - 1) + values[i]) / period;
    }

    return smoothed;
  }
}
