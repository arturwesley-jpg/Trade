/**
 * Anomaly Detection System
 * Detects unusual market behavior using statistical and ML methods
 */

import { DataPreprocessor } from '../preprocessing/data-preprocessor.js';

export interface AnomalyScore {
  timestamp: number;
  score: number;
  isAnomaly: boolean;
  method: string;
  details: Record<string, any>;
}

export interface AnomalyDetectionConfig {
  threshold: number;
  windowSize: number;
  sensitivity: number;
}

export class AnomalyDetector {
  private config: AnomalyDetectionConfig;
  private historicalData: number[] = [];
  private historicalStats: { mean: number; std: number } | null = null;

  constructor(config: Partial<AnomalyDetectionConfig> = {}) {
    this.config = {
      threshold: config.threshold || 3.0,
      windowSize: config.windowSize || 100,
      sensitivity: config.sensitivity || 0.95
    };
  }

  /**
   * Detect anomalies using Z-score method
   */
  detectZScore(data: number[]): AnomalyScore[] {
    const normalized = DataPreprocessor.zScoreNormalize(data);
    const anomalies: AnomalyScore[] = [];

    for (let i = 0; i < data.length; i++) {
      const zScore = Math.abs(normalized.normalized[i]);
      const isAnomaly = zScore > this.config.threshold;

      anomalies.push({
        timestamp: Date.now() - (data.length - i) * 60000,
        score: zScore,
        isAnomaly,
        method: 'z-score',
        details: {
          value: data[i],
          mean: normalized.mean,
          std: normalized.std,
          zScore
        }
      });
    }

    return anomalies;
  }

  /**
   * Detect anomalies using Isolation Forest-like approach
   */
  detectIsolationForest(data: number[]): AnomalyScore[] {
    const anomalies: AnomalyScore[] = [];
    const trees = this.buildIsolationTrees(data, 100);

    for (let i = 0; i < data.length; i++) {
      const avgPathLength = this.averagePathLength(data[i], trees);
      const expectedLength = this.expectedPathLength(data.length);
      const anomalyScore = Math.pow(2, -avgPathLength / expectedLength);

      const isAnomaly = anomalyScore > this.config.sensitivity;

      anomalies.push({
        timestamp: Date.now() - (data.length - i) * 60000,
        score: anomalyScore,
        isAnomaly,
        method: 'isolation-forest',
        details: {
          value: data[i],
          avgPathLength,
          expectedLength
        }
      });
    }

    return anomalies;
  }

  private buildIsolationTrees(data: number[], numTrees: number): IsolationTree[] {
    const trees: IsolationTree[] = [];
    const subsampleSize = Math.min(256, data.length);

    for (let i = 0; i < numTrees; i++) {
      const subsample = this.randomSubsample(data, subsampleSize);
      trees.push(this.buildTree(subsample, 0, Math.ceil(Math.log2(subsampleSize))));
    }

    return trees;
  }

  private buildTree(data: number[], depth: number, maxDepth: number): IsolationTree {
    if (depth >= maxDepth || data.length <= 1) {
      return { isLeaf: true, size: data.length };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const splitValue = min + Math.random() * (max - min);

    const left = data.filter(x => x < splitValue);
    const right = data.filter(x => x >= splitValue);

    if (left.length === 0 || right.length === 0) {
      return { isLeaf: true, size: data.length };
    }

    return {
      isLeaf: false,
      splitValue,
      left: this.buildTree(left, depth + 1, maxDepth),
      right: this.buildTree(right, depth + 1, maxDepth)
    };
  }

  private averagePathLength(value: number, trees: IsolationTree[]): number {
    const pathLengths = trees.map(tree => this.pathLength(value, tree, 0));
    return pathLengths.reduce((sum, len) => sum + len, 0) / trees.length;
  }

  private pathLength(value: number, tree: IsolationTree, depth: number): number {
    if (tree.isLeaf) {
      return depth + this.adjustmentFactor(tree.size);
    }

    if (value < tree.splitValue!) {
      return this.pathLength(value, tree.left!, depth + 1);
    } else {
      return this.pathLength(value, tree.right!, depth + 1);
    }
  }

  private adjustmentFactor(size: number): number {
    if (size <= 1) return 0;
    return 2 * (Math.log(size - 1) + 0.5772156649) - (2 * (size - 1) / size);
  }

  private expectedPathLength(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }

  private randomSubsample(data: number[], size: number): number[] {
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, size);
  }

  /**
   * Detect anomalies using Moving Average Convergence Divergence
   */
  detectMACD(data: number[]): AnomalyScore[] {
    const anomalies: AnomalyScore[] = [];
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    const macd = ema12.map((val, i) => val - ema26[i]);
    const signal = this.calculateEMA(macd, 9);
    const histogram = macd.map((val, i) => val - signal[i]);

    // Detect anomalies in histogram
    const histogramNorm = DataPreprocessor.zScoreNormalize(histogram);

    for (let i = 0; i < data.length; i++) {
      const zScore = Math.abs(histogramNorm.normalized[i]);
      const isAnomaly = zScore > this.config.threshold;

      anomalies.push({
        timestamp: Date.now() - (data.length - i) * 60000,
        score: zScore,
        isAnomaly,
        method: 'macd',
        details: {
          value: data[i],
          macd: macd[i],
          signal: signal[i],
          histogram: histogram[i]
        }
      });
    }

    return anomalies;
  }

  private calculateEMA(data: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    ema[0] = data[0];

    for (let i = 1; i < data.length; i++) {
      ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }

    return ema;
  }

  /**
   * Detect volume anomalies
   */
  detectVolumeAnomalies(volumes: number[]): AnomalyScore[] {
    const anomalies: AnomalyScore[] = [];
    const rollingStats = DataPreprocessor.rollingStatistics(volumes, this.config.windowSize);

    for (let i = 0; i < volumes.length; i++) {
      const zScore = rollingStats.std[i] > 0
        ? Math.abs((volumes[i] - rollingStats.mean[i]) / rollingStats.std[i])
        : 0;

      const isAnomaly = zScore > this.config.threshold;

      anomalies.push({
        timestamp: Date.now() - (volumes.length - i) * 60000,
        score: zScore,
        isAnomaly,
        method: 'volume',
        details: {
          volume: volumes[i],
          rollingMean: rollingStats.mean[i],
          rollingStd: rollingStats.std[i],
          zScore
        }
      });
    }

    return anomalies;
  }

  /**
   * Detect price spike anomalies
   */
  detectPriceSpikes(prices: number[]): AnomalyScore[] {
    const returns = DataPreprocessor.percentageChange(prices);
    const anomalies: AnomalyScore[] = [];
    const normalized = DataPreprocessor.zScoreNormalize(returns);

    for (let i = 0; i < prices.length; i++) {
      const zScore = Math.abs(normalized.normalized[i]);
      const isAnomaly = zScore > this.config.threshold;

      anomalies.push({
        timestamp: Date.now() - (prices.length - i) * 60000,
        score: zScore,
        isAnomaly,
        method: 'price-spike',
        details: {
          price: prices[i],
          return: returns[i],
          zScore
        }
      });
    }

    return anomalies;
  }

  /**
   * Ensemble anomaly detection combining multiple methods
   */
  detectEnsemble(data: number[]): AnomalyScore[] {
    const zScoreAnomalies = this.detectZScore(data);
    const isolationAnomalies = this.detectIsolationForest(data);
    const macdAnomalies = this.detectMACD(data);

    const ensemble: AnomalyScore[] = [];

    for (let i = 0; i < data.length; i++) {
      const scores = [
        zScoreAnomalies[i].score,
        isolationAnomalies[i].score,
        macdAnomalies[i].score
      ];

      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const votes = [
        zScoreAnomalies[i].isAnomaly,
        isolationAnomalies[i].isAnomaly,
        macdAnomalies[i].isAnomaly
      ].filter(Boolean).length;

      ensemble.push({
        timestamp: Date.now() - (data.length - i) * 60000,
        score: avgScore,
        isAnomaly: votes >= 2,
        method: 'ensemble',
        details: {
          value: data[i],
          votes,
          methods: {
            zScore: zScoreAnomalies[i],
            isolation: isolationAnomalies[i],
            macd: macdAnomalies[i]
          }
        }
      });
    }

    return ensemble;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AnomalyDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AnomalyDetectionConfig {
    return { ...this.config };
  }
}

interface IsolationTree {
  isLeaf: boolean;
  size?: number;
  splitValue?: number;
  left?: IsolationTree;
  right?: IsolationTree;
}
