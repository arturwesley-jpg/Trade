/**
 * Feature Engineering for ML Models
 * Extracts and transforms features from market data
 */

import type { Candle } from '@trade/shared';
import { RSI, MACD, BollingerBands, ATR, ADX, OBV, Stochastic } from '@trade/trading-core';

export interface FeatureSet {
  timestamp: number;
  features: Record<string, number>;
  target?: number;
}

export interface FeatureConfig {
  includeTechnicalIndicators: boolean;
  includeVolumeFeatures: boolean;
  includePriceFeatures: boolean;
  includeTimeFeatures: boolean;
  includeSentiment?: boolean;
  customFeatures?: string[];
}

export class FeatureEngineering {
  private config: FeatureConfig;

  constructor(config: Partial<FeatureConfig> = {}) {
    this.config = {
      includeTechnicalIndicators: config.includeTechnicalIndicators ?? true,
      includeVolumeFeatures: config.includeVolumeFeatures ?? true,
      includePriceFeatures: config.includePriceFeatures ?? true,
      includeTimeFeatures: config.includeTimeFeatures ?? true,
      includeSentiment: config.includeSentiment ?? false,
      customFeatures: config.customFeatures ?? []
    };
  }

  /**
   * Extract all features from candle data
   */
  extractFeatures(candles: Candle[], sentimentScores?: number[]): FeatureSet[] {
    const featureSets: FeatureSet[] = [];

    // Need minimum data for indicators
    const minLength = 50;
    if (candles.length < minLength) {
      throw new Error(`Need at least ${minLength} candles for feature extraction`);
    }

    for (let i = minLength; i < candles.length; i++) {
      const windowCandles = candles.slice(0, i + 1);
      const features: Record<string, number> = {};

      // Price features
      if (this.config.includePriceFeatures) {
        Object.assign(features, this.extractPriceFeatures(windowCandles));
      }

      // Technical indicators
      if (this.config.includeTechnicalIndicators) {
        Object.assign(features, this.extractTechnicalIndicators(windowCandles));
      }

      // Volume features
      if (this.config.includeVolumeFeatures) {
        Object.assign(features, this.extractVolumeFeatures(windowCandles));
      }

      // Time features
      if (this.config.includeTimeFeatures) {
        Object.assign(features, this.extractTimeFeatures(candles[i]));
      }

      // Sentiment features
      if (this.config.includeSentiment && sentimentScores && sentimentScores[i] !== undefined) {
        features.sentiment = sentimentScores[i];
      }

      featureSets.push({
        timestamp: candles[i].timestamp,
        features
      });
    }

    return featureSets;
  }

  /**
   * Extract price-based features
   */
  private extractPriceFeatures(candles: Candle[]): Record<string, number> {
    const current = candles[candles.length - 1];
    const features: Record<string, number> = {};

    // Current price features
    features.close = current.close;
    features.open = current.open;
    features.high = current.high;
    features.low = current.low;

    // Price range
    features.range = current.high - current.low;
    features.rangePercent = (features.range / current.low) * 100;

    // Body and shadows
    features.body = Math.abs(current.close - current.open);
    features.bodyPercent = (features.body / features.range) * 100;
    features.upperShadow = current.high - Math.max(current.open, current.close);
    features.lowerShadow = Math.min(current.open, current.close) - current.low;

    // Returns
    if (candles.length >= 2) {
      const prev = candles[candles.length - 2];
      features.return1 = (current.close - prev.close) / prev.close;
      features.logReturn1 = Math.log(current.close / prev.close);
    }

    if (candles.length >= 6) {
      const prev5 = candles[candles.length - 6];
      features.return5 = (current.close - prev5.close) / prev5.close;
    }

    if (candles.length >= 11) {
      const prev10 = candles[candles.length - 11];
      features.return10 = (current.close - prev10.close) / prev10.close;
    }

    if (candles.length >= 21) {
      const prev20 = candles[candles.length - 21];
      features.return20 = (current.close - prev20.close) / prev20.close;
    }

    // Moving averages
    features.sma5 = this.calculateSMA(candles, 5);
    features.sma10 = this.calculateSMA(candles, 10);
    features.sma20 = this.calculateSMA(candles, 20);
    features.sma50 = this.calculateSMA(candles, 50);

    // Price relative to moving averages
    features.priceToSma5 = (current.close - features.sma5) / features.sma5;
    features.priceToSma20 = (current.close - features.sma20) / features.sma20;
    features.priceToSma50 = (current.close - features.sma50) / features.sma50;

    // Volatility
    features.volatility10 = this.calculateVolatility(candles, 10);
    features.volatility20 = this.calculateVolatility(candles, 20);

    return features;
  }

  /**
   * Extract technical indicator features
   */
  private extractTechnicalIndicators(candles: Candle[]): Record<string, number> {
    const features: Record<string, number> = {};

    // RSI
    const rsi14 = RSI.calculate(candles, 14);
    if (rsi14.length > 0) {
      features.rsi14 = rsi14[rsi14.length - 1].value;
    }

    // MACD
    const macd = MACD.calculate(candles);
    if (macd.length > 0) {
      const lastMacd = macd[macd.length - 1];
      features.macd = lastMacd.macd;
      features.macdSignal = lastMacd.signal;
      features.macdHistogram = lastMacd.histogram;
    }

    // Bollinger Bands
    const bb = BollingerBands.calculate(candles, 20, 2);
    if (bb.length > 0) {
      const lastBB = bb[bb.length - 1];
      const current = candles[candles.length - 1];
      features.bbUpper = lastBB.upper;
      features.bbMiddle = lastBB.middle;
      features.bbLower = lastBB.lower;
      features.bbWidth = (lastBB.upper - lastBB.lower) / lastBB.middle;
      features.bbPosition = (current.close - lastBB.lower) / (lastBB.upper - lastBB.lower);
    }

    // ATR
    const atr = ATR.calculate(candles, 14);
    if (atr.length > 0) {
      features.atr14 = atr[atr.length - 1].value;
      features.atrPercent = (features.atr14 / candles[candles.length - 1].close) * 100;
    }

    // ADX
    const adx = ADX.calculate(candles, 14);
    if (adx.length > 0) {
      const lastADX = adx[adx.length - 1];
      features.adx = lastADX.adx;
      features.plusDI = lastADX.plusDI;
      features.minusDI = lastADX.minusDI;
    }

    // Stochastic
    const stoch = Stochastic.calculate(candles, 14, 3);
    if (stoch.length > 0) {
      const lastStoch = stoch[stoch.length - 1];
      features.stochK = lastStoch.k;
      features.stochD = lastStoch.d;
    }

    // OBV
    const obv = OBV.calculate(candles);
    if (obv.length > 0) {
      features.obv = obv[obv.length - 1].value;

      // OBV trend
      if (obv.length >= 10) {
        const obvChange = obv[obv.length - 1].value - obv[obv.length - 10].value;
        features.obvTrend = obvChange / Math.abs(obv[obv.length - 10].value);
      }
    }

    return features;
  }

  /**
   * Extract volume-based features
   */
  private extractVolumeFeatures(candles: Candle[]): Record<string, number> {
    const features: Record<string, number> = {};
    const current = candles[candles.length - 1];

    features.volume = current.volume;

    // Volume moving averages
    features.volumeSma5 = this.calculateVolumeSMA(candles, 5);
    features.volumeSma10 = this.calculateVolumeSMA(candles, 10);
    features.volumeSma20 = this.calculateVolumeSMA(candles, 20);

    // Volume relative to average
    features.volumeRatio5 = current.volume / features.volumeSma5;
    features.volumeRatio20 = current.volume / features.volumeSma20;

    // Volume trend
    if (candles.length >= 6) {
      const volumeChange = current.volume - candles[candles.length - 6].volume;
      features.volumeTrend5 = volumeChange / candles[candles.length - 6].volume;
    }

    // Price-volume correlation
    if (candles.length >= 21) {
      features.priceVolumeCorr = this.calculatePriceVolumeCorrelation(candles, 20);
    }

    return features;
  }

  /**
   * Extract time-based features
   */
  private extractTimeFeatures(candle: Candle): Record<string, number> {
    const features: Record<string, number> = {};
    const date = new Date(candle.timestamp);

    // Hour of day (0-23)
    features.hour = date.getUTCHours();

    // Day of week (0-6, 0 = Sunday)
    features.dayOfWeek = date.getUTCDay();

    // Day of month (1-31)
    features.dayOfMonth = date.getUTCDate();

    // Month (0-11)
    features.month = date.getUTCMonth();

    // Cyclical encoding for hour
    features.hourSin = Math.sin(2 * Math.PI * features.hour / 24);
    features.hourCos = Math.cos(2 * Math.PI * features.hour / 24);

    // Cyclical encoding for day of week
    features.dayOfWeekSin = Math.sin(2 * Math.PI * features.dayOfWeek / 7);
    features.dayOfWeekCos = Math.cos(2 * Math.PI * features.dayOfWeek / 7);

    return features;
  }

  /**
   * Normalize features using z-score normalization
   */
  normalizeFeatures(featureSets: FeatureSet[]): {
    normalized: FeatureSet[];
    stats: Record<string, { mean: number; std: number }>;
  } {
    const stats: Record<string, { mean: number; std: number }> = {};
    const featureNames = Object.keys(featureSets[0].features);

    // Calculate mean and std for each feature
    for (const name of featureNames) {
      const values = featureSets.map(fs => fs.features[name]);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);

      stats[name] = { mean, std: std || 1 };
    }

    // Normalize
    const normalized = featureSets.map(fs => ({
      timestamp: fs.timestamp,
      features: Object.fromEntries(
        Object.entries(fs.features).map(([name, value]) => [
          name,
          (value - stats[name].mean) / stats[name].std
        ])
      ),
      target: fs.target
    }));

    return { normalized, stats };
  }

  // Helper methods

  private calculateSMA(candles: Candle[], period: number): number {
    if (candles.length < period) return candles[candles.length - 1].close;

    const recentCandles = candles.slice(-period);
    const sum = recentCandles.reduce((acc, c) => acc + c.close, 0);
    return sum / period;
  }

  private calculateVolumeSMA(candles: Candle[], period: number): number {
    if (candles.length < period) return candles[candles.length - 1].volume;

    const recentCandles = candles.slice(-period);
    const sum = recentCandles.reduce((acc, c) => acc + c.volume, 0);
    return sum / period;
  }

  private calculateVolatility(candles: Candle[], period: number): number {
    if (candles.length < period + 1) return 0;

    const recentCandles = candles.slice(-period - 1);
    const returns: number[] = [];

    for (let i = 1; i < recentCandles.length; i++) {
      const ret = Math.log(recentCandles[i].close / recentCandles[i - 1].close);
      returns.push(ret);
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

    return Math.sqrt(variance) * Math.sqrt(365); // Annualized
  }

  private calculatePriceVolumeCorrelation(candles: Candle[], period: number): number {
    if (candles.length < period) return 0;

    const recentCandles = candles.slice(-period);
    const prices = recentCandles.map(c => c.close);
    const volumes = recentCandles.map(c => c.volume);

    const priceMean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const volumeMean = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;

    let covariance = 0;
    let priceVariance = 0;
    let volumeVariance = 0;

    for (let i = 0; i < prices.length; i++) {
      const priceDiff = prices[i] - priceMean;
      const volumeDiff = volumes[i] - volumeMean;

      covariance += priceDiff * volumeDiff;
      priceVariance += priceDiff * priceDiff;
      volumeVariance += volumeDiff * volumeDiff;
    }

    const denominator = Math.sqrt(priceVariance * volumeVariance);
    return denominator === 0 ? 0 : covariance / denominator;
  }
}
