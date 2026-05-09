/**
 * Volume Analysis Calculator
 *
 * Analyzes trading volume patterns to identify accumulation, distribution,
 * and potential trend changes. Volume is a key confirmation indicator.
 *
 * Metrics:
 * - Volume Trend: Rising or falling volume
 * - Volume Ratio: Current volume vs average volume
 * - Volume Price Trend (VPT): Cumulative volume adjusted by price change
 * - Accumulation/Distribution: Volume-weighted price momentum
 *
 * Interpretation:
 * - High volume + price increase: Strong bullish signal
 * - High volume + price decrease: Strong bearish signal
 * - Low volume: Weak trend, potential reversal
 * - Volume divergence: Trend may be weakening
 */

export interface VolumeAnalysisResult {
  currentVolume: number;
  averageVolume: number;
  volumeRatio: number; // current / average
  volumeTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  volumePriceTrend: number;
  accumulationDistribution: number;
  signal: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  strength: number; // 0-1 scale based on volume ratio
  priceVolumeConfirmation: boolean;
  timestamp: Date;
}

export interface VolumeAnalysisConfig {
  averagePeriod?: number; // Default: 20
  trendPeriod?: number; // Default: 10
  highVolumeThreshold?: number; // Default: 1.5 (150% of average)
  lowVolumeThreshold?: number; // Default: 0.5 (50% of average)
}

export class VolumeAnalysisCalculator {
  private averagePeriod: number;
  private trendPeriod: number;
  private highVolumeThreshold: number;
  private lowVolumeThreshold: number;

  constructor(config: VolumeAnalysisConfig = {}) {
    this.averagePeriod = config.averagePeriod ?? 20;
    this.trendPeriod = config.trendPeriod ?? 10;
    this.highVolumeThreshold = config.highVolumeThreshold ?? 1.5;
    this.lowVolumeThreshold = config.lowVolumeThreshold ?? 0.5;
  }

  /**
   * Calculate average volume
   */
  private calculateAverageVolume(volumes: number[]): number {
    if (volumes.length === 0) return 0;
    return volumes.reduce((a, b) => a + b, 0) / volumes.length;
  }

  /**
   * Calculate Volume Price Trend (VPT)
   * VPT = Previous VPT + Volume * (Close - Previous Close) / Previous Close
   */
  private calculateVPT(closes: number[], volumes: number[]): number {
    if (closes.length < 2 || volumes.length < 2) {
      return 0;
    }

    let vpt = 0;
    for (let i = 1; i < closes.length; i++) {
      const priceChange = closes[i] - closes[i - 1];
      const percentChange = closes[i - 1] !== 0 ? priceChange / closes[i - 1] : 0;
      vpt += volumes[i] * percentChange;
    }

    return vpt;
  }

  /**
   * Calculate Accumulation/Distribution Line
   * AD = Previous AD + ((Close - Low) - (High - Close)) / (High - Low) * Volume
   */
  private calculateAccumulationDistribution(
    closes: number[],
    highs: number[],
    lows: number[],
    volumes: number[]
  ): number {
    if (closes.length < 1) {
      return 0;
    }

    let ad = 0;
    for (let i = 0; i < closes.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const close = closes[i];
      const volume = volumes[i];

      const range = high - low;
      if (range === 0) {
        continue; // Skip if no range
      }

      const moneyFlowMultiplier = ((close - low) - (high - close)) / range;
      const moneyFlowVolume = moneyFlowMultiplier * volume;
      ad += moneyFlowVolume;
    }

    return ad;
  }

  /**
   * Determine volume trend
   */
  private determineVolumeTrend(volumes: number[]): 'INCREASING' | 'DECREASING' | 'STABLE' {
    if (volumes.length < this.trendPeriod) {
      return 'STABLE';
    }

    const recentVolumes = volumes.slice(-this.trendPeriod);
    const firstHalf = recentVolumes.slice(0, Math.floor(this.trendPeriod / 2));
    const secondHalf = recentVolumes.slice(Math.floor(this.trendPeriod / 2));

    const firstAvg = this.calculateAverageVolume(firstHalf);
    const secondAvg = this.calculateAverageVolume(secondHalf);

    if (secondAvg > firstAvg * 1.1) {
      return 'INCREASING';
    } else if (secondAvg < firstAvg * 0.9) {
      return 'DECREASING';
    }

    return 'STABLE';
  }

  /**
   * Check if price movement is confirmed by volume
   */
  private checkPriceVolumeConfirmation(
    closes: number[],
    volumes: number[],
    averageVolume: number
  ): boolean {
    if (closes.length < 2 || volumes.length < 2) {
      return false;
    }

    const priceChange = closes[closes.length - 1] - closes[closes.length - 2];
    const currentVolume = volumes[volumes.length - 1];

    // Strong price move should be accompanied by above-average volume
    const significantPriceMove = Math.abs(priceChange / closes[closes.length - 2]) > 0.02; // 2% move
    const highVolume = currentVolume > averageVolume * 1.2;

    return significantPriceMove && highVolume;
  }

  /**
   * Calculate volume analysis with full OHLCV data
   */
  calculateWithOHLCV(
    closes: number[],
    highs: number[],
    lows: number[],
    volumes: number[]
  ): VolumeAnalysisResult | null {
    if (
      closes.length < this.averagePeriod ||
      highs.length !== closes.length ||
      lows.length !== closes.length ||
      volumes.length !== closes.length
    ) {
      return null;
    }

    const currentVolume = volumes[volumes.length - 1];
    const recentVolumes = volumes.slice(-this.averagePeriod);
    const averageVolume = this.calculateAverageVolume(recentVolumes);
    const volumeRatio = averageVolume !== 0 ? currentVolume / averageVolume : 1;

    const volumeTrend = this.determineVolumeTrend(volumes);
    const volumePriceTrend = this.calculateVPT(closes, volumes);
    const accumulationDistribution = this.calculateAccumulationDistribution(
      closes,
      highs,
      lows,
      volumes
    );

    // Determine signal
    let signal: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
    const recentAD = this.calculateAccumulationDistribution(
      closes.slice(-this.trendPeriod),
      highs.slice(-this.trendPeriod),
      lows.slice(-this.trendPeriod),
      volumes.slice(-this.trendPeriod)
    );

    if (recentAD > 0 && volumeTrend === 'INCREASING') {
      signal = 'ACCUMULATION';
    } else if (recentAD < 0 && volumeTrend === 'INCREASING') {
      signal = 'DISTRIBUTION';
    } else {
      signal = 'NEUTRAL';
    }

    // Calculate strength based on volume ratio
    const strength = Math.min(volumeRatio / 2, 1); // Cap at 1.0

    const priceVolumeConfirmation = this.checkPriceVolumeConfirmation(
      closes,
      volumes,
      averageVolume
    );

    return {
      currentVolume,
      averageVolume,
      volumeRatio,
      volumeTrend,
      volumePriceTrend,
      accumulationDistribution,
      signal,
      strength,
      priceVolumeConfirmation,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate basic volume analysis (without high/low data)
   */
  calculate(closes: number[], volumes: number[]): VolumeAnalysisResult | null {
    const minDataPoints = Math.max(2, Math.min(this.averagePeriod, 5));
    if (closes.length < minDataPoints || volumes.length !== closes.length) {
      return null;
    }

    const currentVolume = volumes[volumes.length - 1];
    const recentVolumes = volumes.slice(-this.averagePeriod);
    const averageVolume = this.calculateAverageVolume(recentVolumes);
    const volumeRatio = averageVolume !== 0 ? currentVolume / averageVolume : 1;

    const volumeTrend = this.determineVolumeTrend(volumes);
    const volumePriceTrend = this.calculateVPT(closes, volumes);

    // Simplified A/D without high/low data
    const priceChange = closes[closes.length - 1] - closes[closes.length - 2];
    const accumulationDistribution = priceChange > 0 ? currentVolume : -currentVolume;

    // Determine signal
    let signal: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
    if (volumePriceTrend > 0 && volumeTrend === 'INCREASING') {
      signal = 'ACCUMULATION';
    } else if (volumePriceTrend < 0 && volumeTrend === 'INCREASING') {
      signal = 'DISTRIBUTION';
    } else {
      signal = 'NEUTRAL';
    }

    const strength = Math.min(volumeRatio / 2, 1);
    const priceVolumeConfirmation = this.checkPriceVolumeConfirmation(
      closes,
      volumes,
      averageVolume
    );

    return {
      currentVolume,
      averageVolume,
      volumeRatio,
      volumeTrend,
      volumePriceTrend,
      accumulationDistribution,
      signal,
      strength,
      priceVolumeConfirmation,
      timestamp: new Date(),
    };
  }

  /**
   * Detect volume spikes
   */
  detectVolumeSpike(volumes: number[]): boolean {
    if (volumes.length < this.averagePeriod + 1) {
      return false;
    }

    const currentVolume = volumes[volumes.length - 1];
    const recentVolumes = volumes.slice(-this.averagePeriod - 1, -1);
    const averageVolume = this.calculateAverageVolume(recentVolumes);

    return currentVolume > averageVolume * this.highVolumeThreshold;
  }

  /**
   * Detect volume dryup (unusually low volume)
   */
  detectVolumeDryup(volumes: number[]): boolean {
    if (volumes.length < this.averagePeriod + 1) {
      return false;
    }

    const currentVolume = volumes[volumes.length - 1];
    const recentVolumes = volumes.slice(-this.averagePeriod - 1, -1);
    const averageVolume = this.calculateAverageVolume(recentVolumes);

    return currentVolume < averageVolume * this.lowVolumeThreshold;
  }

  /**
   * Calculate volume-weighted average price (VWAP) for the period
   */
  calculateVWAP(closes: number[], volumes: number[]): number | null {
    if (closes.length === 0 || volumes.length === 0 || closes.length !== volumes.length) {
      return null;
    }

    let totalPriceVolume = 0;
    let totalVolume = 0;

    for (let i = 0; i < closes.length; i++) {
      totalPriceVolume += closes[i] * volumes[i];
      totalVolume += volumes[i];
    }

    return totalVolume !== 0 ? totalPriceVolume / totalVolume : null;
  }
}