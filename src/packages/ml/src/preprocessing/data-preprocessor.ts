/**
 * Time Series Preprocessing Utilities
 * Handles data normalization, feature engineering, and sequence preparation
 */

export interface TimeSeriesData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NormalizedData {
  original: number[];
  normalized: number[];
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface SequenceData {
  sequences: number[][][];
  targets: number[];
  timestamps: number[];
}

export class DataPreprocessor {
  /**
   * Normalize data using z-score normalization
   */
  static zScoreNormalize(data: number[]): NormalizedData {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const std = Math.sqrt(variance);

    const normalized = data.map(val => (val - mean) / (std || 1));

    return {
      original: data,
      normalized,
      mean,
      std,
      min: Math.min(...data),
      max: Math.max(...data)
    };
  }

  /**
   * Normalize data using min-max normalization
   */
  static minMaxNormalize(data: number[], min?: number, max?: number): NormalizedData {
    const dataMin = min ?? Math.min(...data);
    const dataMax = max ?? Math.max(...data);
    const range = dataMax - dataMin || 1;

    const normalized = data.map(val => (val - dataMin) / range);

    return {
      original: data,
      normalized,
      mean: data.reduce((sum, val) => sum + val, 0) / data.length,
      std: 0,
      min: dataMin,
      max: dataMax
    };
  }

  /**
   * Denormalize z-score normalized data
   */
  static zScoreDenormalize(normalized: number[], mean: number, std: number): number[] {
    return normalized.map(val => val * std + mean);
  }

  /**
   * Denormalize min-max normalized data
   */
  static minMaxDenormalize(normalized: number[], min: number, max: number): number[] {
    const range = max - min;
    return normalized.map(val => val * range + min);
  }

  /**
   * Create sequences for time series prediction
   */
  static createSequences(
    data: number[],
    sequenceLength: number,
    predictionHorizon: number = 1
  ): SequenceData {
    const sequences: number[][] = [];
    const targets: number[] = [];
    const timestamps: number[] = [];

    for (let i = 0; i < data.length - sequenceLength - predictionHorizon + 1; i++) {
      sequences.push(data.slice(i, i + sequenceLength));
      targets.push(data[i + sequenceLength + predictionHorizon - 1]);
      timestamps.push(i + sequenceLength);
    }

    return {
      sequences: sequences.map(seq => seq.map(val => [val])),
      targets,
      timestamps
    };
  }

  /**
   * Create multi-feature sequences
   */
  static createMultiFeatureSequences(
    features: number[][],
    sequenceLength: number,
    targetIndex: number = 0,
    predictionHorizon: number = 1
  ): SequenceData {
    const sequences: number[][][] = [];
    const targets: number[] = [];
    const timestamps: number[] = [];

    for (let i = 0; i < features.length - sequenceLength - predictionHorizon + 1; i++) {
      const sequence: number[][] = [];
      for (let j = 0; j < sequenceLength; j++) {
        sequence.push(features[i + j]);
      }
      sequences.push(sequence);
      targets.push(features[i + sequenceLength + predictionHorizon - 1][targetIndex]);
      timestamps.push(i + sequenceLength);
    }

    return {
      sequences,
      targets,
      timestamps
    };
  }

  /**
   * Calculate technical features from OHLCV data
   */
  static calculateTechnicalFeatures(data: TimeSeriesData[]): number[][] {
    const features: number[][] = [];

    for (let i = 0; i < data.length; i++) {
      const candle = data[i];
      const feature: number[] = [
        candle.close,
        candle.volume,
        candle.high - candle.low, // Range
        candle.close - candle.open, // Body
        (candle.high - Math.max(candle.open, candle.close)), // Upper shadow
        (Math.min(candle.open, candle.close) - candle.low), // Lower shadow
      ];

      // Add returns
      if (i > 0) {
        feature.push((candle.close - data[i - 1].close) / data[i - 1].close);
      } else {
        feature.push(0);
      }

      // Add moving averages
      if (i >= 9) {
        const ma10 = data.slice(i - 9, i + 1).reduce((sum, d) => sum + d.close, 0) / 10;
        feature.push(ma10);
        feature.push((candle.close - ma10) / ma10);
      } else {
        feature.push(candle.close);
        feature.push(0);
      }

      if (i >= 19) {
        const ma20 = data.slice(i - 19, i + 1).reduce((sum, d) => sum + d.close, 0) / 20;
        feature.push(ma20);
        feature.push((candle.close - ma20) / ma20);
      } else {
        feature.push(candle.close);
        feature.push(0);
      }

      features.push(feature);
    }

    return features;
  }

  /**
   * Split data into train/validation/test sets
   */
  static trainTestSplit<T>(
    data: T[],
    trainRatio: number = 0.7,
    valRatio: number = 0.15
  ): { train: T[]; validation: T[]; test: T[] } {
    const trainSize = Math.floor(data.length * trainRatio);
    const valSize = Math.floor(data.length * valRatio);

    return {
      train: data.slice(0, trainSize),
      validation: data.slice(trainSize, trainSize + valSize),
      test: data.slice(trainSize + valSize)
    };
  }

  /**
   * Calculate rolling statistics
   */
  static rollingStatistics(
    data: number[],
    window: number
  ): { mean: number[]; std: number[]; min: number[]; max: number[] } {
    const means: number[] = [];
    const stds: number[] = [];
    const mins: number[] = [];
    const maxs: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - window + 1);
      const windowData = data.slice(start, i + 1);

      const mean = windowData.reduce((sum, val) => sum + val, 0) / windowData.length;
      const variance = windowData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / windowData.length;

      means.push(mean);
      stds.push(Math.sqrt(variance));
      mins.push(Math.min(...windowData));
      maxs.push(Math.max(...windowData));
    }

    return { mean: means, std: stds, min: mins, max: maxs };
  }

  /**
   * Remove outliers using IQR method
   */
  static removeOutliers(data: number[], multiplier: number = 1.5): number[] {
    const sorted = [...data].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);

    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    const lowerBound = q1 - multiplier * iqr;
    const upperBound = q3 + multiplier * iqr;

    return data.filter(val => val >= lowerBound && val <= upperBound);
  }

  /**
   * Fill missing values using forward fill
   */
  static forwardFill(data: (number | null)[]): number[] {
    const filled: number[] = [];
    let lastValid = 0;

    for (const val of data) {
      if (val !== null && !isNaN(val)) {
        lastValid = val;
        filled.push(val);
      } else {
        filled.push(lastValid);
      }
    }

    return filled;
  }

  /**
   * Calculate percentage changes
   */
  static percentageChange(data: number[]): number[] {
    const changes: number[] = [0];

    for (let i = 1; i < data.length; i++) {
      changes.push((data[i] - data[i - 1]) / data[i - 1]);
    }

    return changes;
  }

  /**
   * Calculate log returns
   */
  static logReturns(data: number[]): number[] {
    const returns: number[] = [0];

    for (let i = 1; i < data.length; i++) {
      returns.push(Math.log(data[i] / data[i - 1]));
    }

    return returns;
  }
}
