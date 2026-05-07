/**
 * Model Management and Versioning System
 * Handles model storage, versioning, and A/B testing
 */

import type { ModelConfig, TrainingResult, Prediction } from './models/price-predictor.js';
import { PricePredictor } from './models/price-predictor.js';
import type { Candle } from '@trade/shared';
import { promises as fs } from 'fs';
import path from 'path';

export interface ModelVersion {
  id: string;
  version: number;
  modelType: string;
  config: ModelConfig;
  metrics: {
    mae: number;
    rmse: number;
    mape: number;
    r2: number;
    accuracy?: number;
  };
  createdAt: number;
  status: 'training' | 'active' | 'archived' | 'failed';
  trainingDataSize: number;
  deployedAt?: number;
}

export interface ABTestConfig {
  modelAId: string;
  modelBId: string;
  trafficSplit: number; // 0-1, percentage to model A
  startTime: number;
  endTime?: number;
  metrics: {
    modelA: { predictions: number; avgConfidence: number; errors: number };
    modelB: { predictions: number; avgConfidence: number; errors: number };
  };
}

export class ModelManager {
  private models: Map<string, PricePredictor> = new Map();
  private versions: Map<string, ModelVersion> = new Map();
  private activeModel: string | null = null;
  private abTest: ABTestConfig | null = null;
  private modelsDir: string;

  constructor(modelsDir: string = './models') {
    this.modelsDir = modelsDir;
  }

  /**
   * Initialize model manager and load existing models
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.modelsDir, { recursive: true });
      await this.loadVersions();
    } catch (error) {
      console.error('Failed to initialize model manager:', error);
    }
  }

  /**
   * Train a new model version
   */
  async trainModel(
    config: ModelConfig,
    trainingData: Candle[],
    symbol: string
  ): Promise<ModelVersion> {
    const predictor = new PricePredictor(config);
    const modelId = `${symbol}_${config.modelType}_${Date.now()}`;

    // Update version status
    const version: ModelVersion = {
      id: modelId,
      version: this.getNextVersion(symbol, config.modelType),
      modelType: config.modelType,
      config,
      metrics: { mae: 0, rmse: 0, mape: 0, r2: 0 },
      createdAt: Date.now(),
      status: 'training',
      trainingDataSize: trainingData.length
    };

    this.versions.set(modelId, version);

    try {
      // Train model
      const result = await predictor.train(trainingData);

      // Update version with results
      version.metrics = result.metrics;
      version.status = 'active';

      // Store model
      this.models.set(modelId, predictor);

      // Save version metadata
      await this.saveVersion(version);

      // Save model weights (simplified - in production use proper serialization)
      await this.saveModelWeights(modelId, predictor);

      return version;
    } catch (error) {
      version.status = 'failed';
      this.versions.set(modelId, version);
      throw error;
    }
  }

  /**
   * Deploy a model version to production
   */
  async deployModel(modelId: string): Promise<void> {
    const version = this.versions.get(modelId);
    if (!version) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (version.status !== 'active') {
      throw new Error(`Model ${modelId} is not in active status`);
    }

    // Archive current active model
    if (this.activeModel) {
      const currentVersion = this.versions.get(this.activeModel);
      if (currentVersion) {
        currentVersion.status = 'archived';
        await this.saveVersion(currentVersion);
      }
    }

    // Deploy new model
    this.activeModel = modelId;
    version.deployedAt = Date.now();
    await this.saveVersion(version);
  }

  /**
   * Start A/B test between two models
   */
  async startABTest(
    modelAId: string,
    modelBId: string,
    trafficSplit: number = 0.5,
    durationHours: number = 24
  ): Promise<ABTestConfig> {
    const modelA = this.versions.get(modelAId);
    const modelB = this.versions.get(modelBId);

    if (!modelA || !modelB) {
      throw new Error('Both models must exist for A/B testing');
    }

    if (trafficSplit < 0 || trafficSplit > 1) {
      throw new Error('Traffic split must be between 0 and 1');
    }

    this.abTest = {
      modelAId,
      modelBId,
      trafficSplit,
      startTime: Date.now(),
      endTime: Date.now() + durationHours * 60 * 60 * 1000,
      metrics: {
        modelA: { predictions: 0, avgConfidence: 0, errors: 0 },
        modelB: { predictions: 0, avgConfidence: 0, errors: 0 }
      }
    };

    await this.saveABTest();
    return this.abTest;
  }

  /**
   * Stop A/B test and select winner
   */
  async stopABTest(deployWinner: boolean = true): Promise<{
    winner: string;
    metrics: ABTestConfig['metrics'];
  }> {
    if (!this.abTest) {
      throw new Error('No active A/B test');
    }

    const { modelAId, modelBId, metrics } = this.abTest;

    // Calculate performance scores
    const scoreA = this.calculateABTestScore(metrics.modelA);
    const scoreB = this.calculateABTestScore(metrics.modelB);

    const winner = scoreA > scoreB ? modelAId : modelBId;

    if (deployWinner) {
      await this.deployModel(winner);
    }

    const result = { winner, metrics };
    this.abTest = null;
    await this.saveABTest();

    return result;
  }

  /**
   * Make prediction using active model or A/B test
   */
  async predict(
    symbol: string,
    currentData: Candle[]
  ): Promise<Prediction & { modelId: string }> {
    let modelId: string;

    // Check if A/B test is active
    if (this.abTest && this.abTest.endTime && Date.now() < this.abTest.endTime) {
      // Route traffic based on split
      const useModelA = Math.random() < this.abTest.trafficSplit;
      modelId = useModelA ? this.abTest.modelAId : this.abTest.modelBId;

      // Update metrics
      const metricsKey = useModelA ? 'modelA' : 'modelB';
      this.abTest.metrics[metricsKey].predictions++;
    } else {
      // Use active model
      if (!this.activeModel) {
        throw new Error('No active model deployed');
      }
      modelId = this.activeModel;
    }

    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not loaded`);
    }

    const prediction = await model.predict(currentData, symbol);

    // Update A/B test metrics
    if (this.abTest && (modelId === this.abTest.modelAId || modelId === this.abTest.modelBId)) {
      const metricsKey = modelId === this.abTest.modelAId ? 'modelA' : 'modelB';
      const metrics = this.abTest.metrics[metricsKey];
      metrics.avgConfidence =
        (metrics.avgConfidence * (metrics.predictions - 1) + prediction.confidence) /
        metrics.predictions;
    }

    return { ...prediction, modelId };
  }

  /**
   * Evaluate model on test data
   */
  async evaluateModel(modelId: string, testData: Candle[]): Promise<ModelVersion['metrics']> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    const metrics = await model.evaluate(testData);

    // Update version metrics
    const version = this.versions.get(modelId);
    if (version) {
      version.metrics = metrics;
      await this.saveVersion(version);
    }

    return metrics;
  }

  /**
   * Get all model versions
   */
  getVersions(symbol?: string, modelType?: string): ModelVersion[] {
    let versions = Array.from(this.versions.values());

    if (symbol) {
      versions = versions.filter(v => v.id.startsWith(symbol));
    }

    if (modelType) {
      versions = versions.filter(v => v.modelType === modelType);
    }

    return versions.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get active model
   */
  getActiveModel(): ModelVersion | null {
    if (!this.activeModel) return null;
    return this.versions.get(this.activeModel) || null;
  }

  /**
   * Get A/B test status
   */
  getABTestStatus(): ABTestConfig | null {
    return this.abTest;
  }

  /**
   * Load model from disk
   */
  async loadModel(modelId: string): Promise<void> {
    const version = this.versions.get(modelId);
    if (!version) {
      throw new Error(`Model version ${modelId} not found`);
    }

    // In production, load actual model weights
    const predictor = new PricePredictor(version.config);
    this.models.set(modelId, predictor);
  }

  // Private helper methods

  private getNextVersion(symbol: string, modelType: string): number {
    const versions = this.getVersions(symbol, modelType);
    if (versions.length === 0) return 1;
    return Math.max(...versions.map(v => v.version)) + 1;
  }

  private calculateABTestScore(metrics: ABTestConfig['metrics']['modelA']): number {
    if (metrics.predictions === 0) return 0;

    const errorRate = metrics.errors / metrics.predictions;
    const confidenceScore = metrics.avgConfidence;

    // Weighted score: 70% confidence, 30% error rate
    return confidenceScore * 0.7 + (1 - errorRate) * 0.3;
  }

  private async saveVersion(version: ModelVersion): Promise<void> {
    const filePath = path.join(this.modelsDir, `${version.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(version, null, 2));
  }

  private async loadVersions(): Promise<void> {
    try {
      const files = await fs.readdir(this.modelsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('abtest'));

      for (const file of jsonFiles) {
        const filePath = path.join(this.modelsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const version: ModelVersion = JSON.parse(content);
        this.versions.set(version.id, version);

        if (version.deployedAt && (!this.activeModel || version.deployedAt > (this.versions.get(this.activeModel)?.deployedAt || 0))) {
          this.activeModel = version.id;
        }
      }

      // Load A/B test if exists
      const abTestPath = path.join(this.modelsDir, 'abtest.json');
      try {
        const abTestContent = await fs.readFile(abTestPath, 'utf-8');
        this.abTest = JSON.parse(abTestContent);
      } catch {
        // No active A/B test
      }
    } catch (error) {
      // Directory doesn't exist yet
    }
  }

  private async saveModelWeights(modelId: string, predictor: PricePredictor): Promise<void> {
    // In production, serialize model weights properly
    // For now, just save a placeholder
    const weightsPath = path.join(this.modelsDir, `${modelId}.weights`);
    await fs.writeFile(weightsPath, JSON.stringify({ modelId, saved: Date.now() }));
  }

  private async saveABTest(): Promise<void> {
    const filePath = path.join(this.modelsDir, 'abtest.json');
    if (this.abTest) {
      await fs.writeFile(filePath, JSON.stringify(this.abTest, null, 2));
    } else {
      try {
        await fs.unlink(filePath);
      } catch {
        // File doesn't exist
      }
    }
  }
}
