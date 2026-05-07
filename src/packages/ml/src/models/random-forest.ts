/**
 * Random Forest Predictor
 * Ensemble learning method for price prediction
 */

export interface RandomForestConfig {
  lookbackPeriod: number;
  numTrees: number;
  maxDepth: number;
  minSamplesSplit: number;
  maxFeatures?: number;
  bootstrap?: boolean;
}

export interface RFPredictionResult {
  prediction: number;
  confidence: number;
  treeVotes: number[];
}

interface DecisionNode {
  isLeaf: boolean;
  value?: number;
  featureIndex?: number;
  threshold?: number;
  left?: DecisionNode;
  right?: DecisionNode;
  samples?: number;
}

export class RandomForestPredictor {
  private config: RandomForestConfig;
  private trees: DecisionNode[] = [];
  private featureImportances: number[] = [];
  private trained: boolean = false;

  constructor(config: RandomForestConfig) {
    this.config = {
      ...config,
      maxFeatures: config.maxFeatures || Math.floor(Math.sqrt(config.lookbackPeriod)),
      bootstrap: config.bootstrap ?? true
    };
  }

  /**
   * Train the Random Forest model
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

    // Initialize feature importances
    this.featureImportances = new Array(trainFeatures[0].length).fill(0);

    // Build trees
    this.trees = [];
    for (let i = 0; i < this.config.numTrees; i++) {
      const { sampledFeatures, sampledTargets } = this.config.bootstrap
        ? this.bootstrapSample(trainFeatures, trainTargets)
        : { sampledFeatures: trainFeatures, sampledTargets: trainTargets };

      const tree = this.buildTree(sampledFeatures, sampledTargets, 0);
      this.trees.push(tree);
    }

    // Normalize feature importances
    const totalImportance = this.featureImportances.reduce((sum, imp) => sum + imp, 0);
    if (totalImportance > 0) {
      this.featureImportances = this.featureImportances.map(imp => imp / totalImportance);
    }

    this.trained = true;

    // Calculate training metrics
    const predictions = trainFeatures.map(f => this.predict(f).prediction);
    return this.calculateMetrics(predictions, trainTargets);
  }

  /**
   * Predict using the trained Random Forest
   */
  predict(features: number[][]): RFPredictionResult {
    if (!this.trained) {
      throw new Error('Model must be trained before prediction');
    }

    const lastFeature = features[features.length - 1];
    const treePredictions: number[] = [];

    for (const tree of this.trees) {
      const prediction = this.predictTree(tree, lastFeature);
      treePredictions.push(prediction);
    }

    // Average predictions
    const prediction = treePredictions.reduce((sum, p) => sum + p, 0) / treePredictions.length;

    // Calculate confidence based on prediction variance
    const variance = treePredictions.reduce(
      (sum, p) => sum + Math.pow(p - prediction, 2),
      0
    ) / treePredictions.length;
    const confidence = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / prediction));

    return {
      prediction,
      confidence,
      treeVotes: treePredictions
    };
  }

  private buildTree(
    features: number[][],
    targets: number[],
    depth: number
  ): DecisionNode {
    // Stopping criteria
    if (
      depth >= this.config.maxDepth ||
      features.length < this.config.minSamplesSplit ||
      this.isPure(targets)
    ) {
      return {
        isLeaf: true,
        value: this.calculateMean(targets),
        samples: features.length
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
        value: this.calculateMean(targets),
        samples: features.length
      };
    }

    // Update feature importance
    this.featureImportances[featureIndex] += this.calculateImpurityReduction(
      targets,
      leftIndices,
      rightIndices
    );

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
      right: this.buildTree(rightFeatures, rightTargets, depth + 1),
      samples: features.length
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

    // Randomly select features to consider
    const numFeatures = features[0].length;
    const featureIndices = this.randomFeatureSelection(numFeatures);

    for (const featureIndex of featureIndices) {
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

  private calculateImpurityReduction(
    targets: number[],
    leftIndices: number[],
    rightIndices: number[]
  ): number {
    const totalVariance = this.calculateVariance(targets);
    const leftVariance = this.calculateVariance(leftIndices.map(i => targets[i]));
    const rightVariance = this.calculateVariance(rightIndices.map(i => targets[i]));

    const leftWeight = leftIndices.length / targets.length;
    const rightWeight = rightIndices.length / targets.length;

    return totalVariance - (leftWeight * leftVariance + rightWeight * rightVariance);
  }

  private predictTree(node: DecisionNode, features: number[]): number {
    if (node.isLeaf) {
      return node.value!;
    }

    if (features[node.featureIndex!] <= node.threshold!) {
      return this.predictTree(node.left!, features);
    } else {
      return this.predictTree(node.right!, features);
    }
  }

  private bootstrapSample(
    features: number[][],
    targets: number[]
  ): { sampledFeatures: number[][]; sampledTargets: number[] } {
    const sampledFeatures: number[][] = [];
    const sampledTargets: number[] = [];

    for (let i = 0; i < features.length; i++) {
      const index = Math.floor(Math.random() * features.length);
      sampledFeatures.push(features[index]);
      sampledTargets.push(targets[index]);
    }

    return { sampledFeatures, sampledTargets };
  }

  private randomFeatureSelection(numFeatures: number): number[] {
    const indices = Array.from({ length: numFeatures }, (_, i) => i);
    const selected: number[] = [];

    for (let i = 0; i < this.config.maxFeatures!; i++) {
      const randomIndex = Math.floor(Math.random() * indices.length);
      selected.push(indices[randomIndex]);
      indices.splice(randomIndex, 1);
    }

    return selected;
  }

  private isPure(targets: number[]): boolean {
    const variance = this.calculateVariance(targets);
    return variance < 0.0001;
  }

  private calculateMean(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculateVariance(values: number[]): number {
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

  getFeatureImportances(): number[] {
    return [...this.featureImportances];
  }

  isTrained(): boolean {
    return this.trained;
  }
}
