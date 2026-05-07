/**
 * Gradient Boosting Predictor
 * Sequential ensemble method for price prediction
 */

export interface GradientBoostingConfig {
  lookbackPeriod: number;
  numEstimators: number;
  learningRate: number;
  maxDepth: number;
  minSamplesSplit?: number;
  subsample?: number;
}

export interface GBPredictionResult {
  prediction: number;
  confidence: number;
  estimatorContributions: number[];
}

interface GBTree {
  root: GBNode;
}

interface GBNode {
  isLeaf: boolean;
  value?: number;
  featureIndex?: number;
  threshold?: number;
  left?: GBNode;
  right?: GBNode;
}

export class GradientBoostingPredictor {
  private config: GradientBoostingConfig;
  private trees: GBTree[] = [];
  private initialPrediction: number = 0;
  private trained: boolean = false;

  constructor(config: GradientBoostingConfig) {
    this.config = {
      ...config,
      minSamplesSplit: config.minSamplesSplit || 2,
      subsample: config.subsample || 1.0
    };
  }

  /**
   * Train the Gradient Boosting model
   */
  async train(
    features: number[][],
    targets: number[],
    horizon: number
  ): Promise<{
    mae: number;
    rmse: number;
    mape: number;
    r2: number;
  }> {
    if (features.length !== targets.length) {
      throw new Error('Features and targets must have the same length');
    }

    // Prepare training data with target horizon
    const trainFeatures: number[][] = [];
    const trainTargets: number[] = [];

    for (let i = 0; i < features.length - horizon; i++) {
      trainFeatures.push(features[i]);
      trainTargets.push(targets[i + horizon]);
    }

    // Initialize with mean prediction
    this.initialPrediction = this.calculateMean(trainTargets);

    // Initialize residuals
    let residuals = trainTargets.map(t => t - this.initialPrediction);

    // Build trees sequentially
    this.trees = [];
    for (let i = 0; i < this.config.numEstimators; i++) {
      // Subsample if needed
      const { sampledFeatures, sampledResiduals } = this.subsample(
        trainFeatures,
        residuals
      );

      // Build tree to predict residuals
      const tree = this.buildTree(sampledFeatures, sampledResiduals, 0);
      this.trees.push({ root: tree });

      // Update residuals
      for (let j = 0; j < trainFeatures.length; j++) {
        const prediction = this.predictTree(tree, trainFeatures[j]);
        residuals[j] -= this.config.learningRate * prediction;
      }
    }

    this.trained = true;

    // Calculate training metrics
    const predictions = trainFeatures.map(f => this.predict(f).prediction);
    return this.calculateMetrics(predictions, trainTargets);
  }

  /**
   * Predict using the trained Gradient Boosting model
   */
  predict(features: number[][]): GBPredictionResult {
    if (!this.trained) {
      throw new Error('Model must be trained before prediction');
    }

    const lastFeature = features[features.length - 1];
    let prediction = this.initialPrediction;
    const contributions: number[] = [];

    for (const tree of this.trees) {
      const treePrediction = this.predictTree(tree.root, lastFeature);
      const contribution = this.config.learningRate * treePrediction;
      prediction += contribution;
      contributions.push(contribution);
    }

    // Calculate confidence based on contribution variance
    const contributionMean = contributions.reduce((sum, c) => sum + c, 0) / contributions.length;
    const contributionVariance = contributions.reduce(
      (sum, c) => sum + Math.pow(c - contributionMean, 2),
      0
    ) / contributions.length;
    const confidence = Math.max(0, Math.min(1, 1 - Math.sqrt(contributionVariance) / Math.abs(prediction)));

    return {
      prediction,
      confidence,
      estimatorContributions: contributions
    };
  }

  private buildTree(
    features: number[][],
    targets: number[],
    depth: number
  ): GBNode {
    // Stopping criteria
    if (
      depth >= this.config.maxDepth ||
      features.length < this.config.minSamplesSplit! ||
      this.isPure(targets)
    ) {
      return {
        isLeaf: true,
        value: this.calculateMean(targets)
      };
    }

    // Find best split
    const { featureIndex, threshold, leftIndices, rightIndices } = this.findBestSplit(
      features,
      targets
    );

    if (leftIndices.length === 0 || rightIndices.length === 0) {
      return {
        isLeaf: true,
        value: this.calculateMean(targets)
      };
    }

    // Recursively build subtrees
    const leftFeatures = leftIndices.map(i => features[i]);
    const leftTargets = leftIndices.map(i => targets[i]);
    const rightFeatures = rightIndices.map(i => features[i]);
    const rightTargets = rightIndices.map(i => targets[i]);

    return {
      isLeaf: false,
      featureIndex,
      threshold,
      left: this.buildTree(leftFeatures, leftTargets, depth + 1),
      right: this.buildTree(rightFeatures, rightTargets, depth + 1)
    };
  }

  private findBestSplit(
    features: number[][],
    targets: number[]
  ): {
    featureIndex: number;
    threshold: number;
    leftIndices: number[];
    rightIndices: number[];
  } {
    let bestMSE = Infinity;
    let bestFeatureIndex = 0;
    let bestThreshold = 0;
    let bestLeftIndices: number[] = [];
    let bestRightIndices: number[] = [];

    const numFeatures = features[0].length;

    for (let featureIndex = 0; featureIndex < numFeatures; featureIndex++) {
      const values = features.map(f => f[featureIndex]);
      const uniqueValues = [...new Set(values)].sort((a, b) => a - b);

      for (let i = 0; i < uniqueValues.length - 1; i++) {
        const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;

        const leftIndices: number[] = [];
        const rightIndices: number[] = [];

        for (let j = 0; j < features.length; j++) {
          if (features[j][featureIndex] <= threshold) {
            leftIndices.push(j);
          } else {
            rightIndices.push(j);
          }
        }

        if (leftIndices.length === 0 || rightIndices.length === 0) continue;

        const mse = this.calculateSplitMSE(targets, leftIndices, rightIndices);

        if (mse < bestMSE) {
          bestMSE = mse;
          bestFeatureIndex = featureIndex;
          bestThreshold = threshold;
          bestLeftIndices = leftIndices;
          bestRightIndices = rightIndices;
        }
      }
    }

    return {
      featureIndex: bestFeatureIndex,
      threshold: bestThreshold,
      leftIndices: bestLeftIndices,
      rightIndices: bestRightIndices
    };
  }

  private calculateSplitMSE(
    targets: number[],
    leftIndices: number[],
    rightIndices: number[]
  ): number {
    const leftTargets = leftIndices.map(i => targets[i]);
    const rightTargets = rightIndices.map(i => targets[i]);

    const leftMean = this.calculateMean(leftTargets);
    const rightMean = this.calculateMean(rightTargets);

    const leftMSE = leftTargets.reduce((sum, t) => sum + Math.pow(t - leftMean, 2), 0);
    const rightMSE = rightTargets.reduce((sum, t) => sum + Math.pow(t - rightMean, 2), 0);

    return (leftMSE + rightMSE) / targets.length;
  }

  private predictTree(node: GBNode, features: number[]): number {
    if (node.isLeaf) {
      return node.value!;
    }

    if (features[node.featureIndex!] <= node.threshold!) {
      return this.predictTree(node.left!, features);
    } else {
      return this.predictTree(node.right!, features);
    }
  }

  private subsample(
    features: number[][],
    targets: number[]
  ): { sampledFeatures: number[][]; sampledResiduals: number[] } {
    if (this.config.subsample === 1.0) {
      return {
        sampledFeatures: features,
        sampledResiduals: targets
      };
    }

    const sampleSize = Math.floor(features.length * this.config.subsample!);
    const sampledFeatures: number[][] = [];
    const sampledResiduals: number[] = [];

    const allIndices = Array.from({ length: features.length }, (_, i) => i);
    for (let i = 0; i < sampleSize; i++) {
      const randomIndex = Math.floor(Math.random() * allIndices.length);
      const index = allIndices[randomIndex];
      sampledFeatures.push(features[index]);
      sampledResiduals.push(targets[index]);
      allIndices.splice(randomIndex, 1);
    }

    return { sampledFeatures, sampledResiduals };
  }

  private isPure(targets: number[]): boolean {
    const variance = this.calculateVariance(targets);
    return variance < 0.0001;
  }

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.calculateMean(values);
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  private calculateMetrics(
    predictions: number[],
    actuals: number[]
  ): { mae: number; rmse: number; mape: number; r2: number } {
    const n = predictions.length;

    const mae = predictions.reduce((sum, pred, i) => sum + Math.abs(pred - actuals[i]), 0) / n;

    const mse = predictions.reduce((sum, pred, i) => sum + Math.pow(pred - actuals[i], 2), 0) / n;
    const rmse = Math.sqrt(mse);

    const mape = predictions.reduce((sum, pred, i) => {
      return sum + Math.abs((actuals[i] - pred) / actuals[i]);
    }, 0) / n * 100;

    const actualMean = this.calculateMean(actuals);
    const ssRes = predictions.reduce((sum, pred, i) => sum + Math.pow(actuals[i] - pred, 2), 0);
    const ssTot = actuals.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0);
    const r2 = 1 - (ssRes / ssTot);

    return { mae, rmse, mape, r2 };
  }

  isTrained(): boolean {
    return this.trained;
  }
}