/**
 * Unified Price Prediction Interface
 * Supports multiple model types: LSTM, Random Forest, Gradient Boosting
 */

import { LSTMPricePredictor, type PredictionResult } from './lstm-predictor.js';
import { RandomForestPredictor } from './random-forest.js';
import { GradientBoostingPredictor } from './gradient-boosting.js';
import type { Candle } from '@trade/shared';

export interface ModelConfig {
  lookbackPeriod: number;
  features: string[];
  targetHorizon: number; // hours ahead
  modelType: 'lstm' | 'rf' | 'gbm';
  hyperparameters?: Record<string, any>;
}

export interface Prediction {
  symbol: string;
  timestamp: number;
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  horizon: number;
  direction: 'up' | 'down' | 'neutral';
  percentageChange: number;
  modelType: string;
  features: Record<string, number>;
}

export interface TrainingResult {
  modelId: string;
  modelType: string;
  trainedAt: number;
  metrics: ModelMetrics;
  config: ModelConfig;
  dataPoints: number;
  trainingTime: number;
}

export interface ModelMetrics {
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Squared Error
  mape: number; // Mean Absolute Percentage Error
  r2: number; // R-squared
  accuracy?: number; // For classification
  precision?: number;
  recall?: number;
  f1Score?: number;
}

export class PricePredictor {
  private config: ModelConfig;
  private model: LSTMPricePredictor | RandomForestPredictor | GradientBoostingPredictor;
  private modelId: string;
  private trainedAt: number = 0;

  constructor(config: ModelConfig) {
    this.config = config;
    this.modelId = this.generateModelId();
    this.model = this.createModel(config);
  }

  private generateModelId(): string {
    return `${this.config.modelType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createModel(
    config: ModelConfig
  ): LSTMPricePredictor | RandomForestPredictor | GradientBoostingPredictor {
    switch (config.modelType) {
      case 'lstm':
        return new LSTMPricePredictor({
          sequenceLength: config.lookbackPeriod,
          inputSize: config.features.length,
          ...config.hyperparameters
        });
      case 'rf':
        return new RandomForestPredictor({
          lookbackPeriod: config.lookbackPeriod,
          numTrees: config.hyperparameters?.numTrees || 100,
          maxDepth: config.hyperparameters?.maxDepth || 10,
          minSamplesSplit: config.hyperparameters?.minSamplesSplit || 2
        });
      case 'gbm':
        return new GradientBoostingPredictor({
          lookbackPeriod: config.lookbackPeriod,
          numEstimators: config.hyperparameters?.numEstimators || 100,
          learningRate: config.hyperparameters?.learningRate || 0.1,
          maxDepth: config.hyperparameters?.maxDepth || 3
        });
      default:
        throw new Error(`Unsupported model type: ${config.modelType}`);
    }
  }

  /**
   * Train the model on historical data
   */
  async train(historicalData: Candle[]): Promise<TrainingResult> {
    const startTime = Date.now();

    if (historicalData.length < this.config.lookbackPeriod + this.config.targetHorizon) {
      throw new Error(
        `Insufficient data. Need at least ${this.config.lookbackPeriod + this.config.targetHorizon} candles`
      );
    }

    // Extract features
    const features = this.extractFeatures(historicalData);
    const prices = historicalData.map(c => c.close);

    // Train model
    let metrics: ModelMetrics;

    if (this.model instanceof LSTMPricePredictor) {
      const trainingMetrics = await this.model.train(prices);
      const lastMetric = trainingMetrics[trainingMetrics.length - 1];
      metrics = {
        mae: lastMetric.mae,
        rmse: lastMetric.rmse,
        mape: 0,
        r2: 0
      };
    } else if (this.model instanceof RandomForestPredictor) {
      metrics = await this.model.train(features, prices, this.config.targetHorizon);
    } else {
      metrics = await this.model.train(features, prices, this.config.targetHorizon);
    }

    this.trainedAt = Date.now();
    const trainingTime = this.trainedAt - startTime;

    return {
      modelId: this.modelId,
      modelType: this.config.modelType,
      trainedAt: this.trainedAt,
      metrics,
      config: this.config,
      dataPoints: historicalData.length,
      trainingTime
    };
  }

  /**
   * Predict future price
   */
  async predict(currentData: Candle[], symbol: string): Promise<Prediction> {
    if (!this.trainedAt) {
      throw new Error('Model must be trained before prediction');
    }

    if (currentData.length < this.config.lookbackPeriod) {
      throw new Error(`Need at least ${this.config.lookbackPeriod} candles for prediction`);
    }

    const recentData = currentData.slice(-this.config.lookbackPeriod);
    const currentPrice = recentData[recentData.length - 1].close;
    const features = this.extractFeatures(recentData);

    let predictedPrice: number;
    let confidence: number;

    if (this.model instanceof LSTMPricePredictor) {
      const prices = recentData.map(c => c.close);
      const predictions = this.model.predict(prices, 1);
      predictedPrice = predictions[0].prediction;
      confidence = predictions[0].confidence;
    } else if (this.model instanceof RandomForestPredictor) {
      const result = this.model.predict(features);
      predictedPrice = result.prediction;
      confidence = result.confidence;
    } else {
      const result = this.model.predict(features);
      predictedPrice = result.prediction;
      confidence = result.confidence;
    }

    const percentageChange = ((predictedPrice - currentPrice) / currentPrice) * 100;
    const direction = percentageChange > 0.5 ? 'up' : percentageChange < -0.5 ? 'down' : 'neutral';

    return {
      symbol,
      timestamp: Date.now(),
      currentPrice,
      predictedPrice,
      confidence,
      horizon: this.config.targetHorizon,
      direction,
      percentageChange,
      modelType: this.config.modelType,
      features: this.getFeatureValues(recentData)
    };
  }

  /**
   * Evaluate model on test data
   */
  async evaluate(testData: Candle[]): Promise<ModelMetrics> {
    if (!this.trainedAt) {
      throw new Error('Model must be trained before evaluation');
    }

    const predictions: number[] = [];
    const actuals: number[] = [];

    for (let i = this.config.lookbackPeriod; i < testData.length - this.config.targetHorizon; i++) {
      const inputData = testData.slice(i - this.config.lookbackPeriod, i);
      const actualPrice = testData[i + this.config.targetHorizon - 1].close;

      try {
        const prediction = await this.predict(inputData, 'TEST');
        predictions.push(prediction.predictedPrice);
        actuals.push(actualPrice);
      } catch (error) {
        continue;
      }
    }

    return this.calculateMetrics(predictions, actuals);
  }

  private calculateMetrics(predictions: number[], actuals: number[]): ModelMetrics {
    const n = predictions.length;

    // MAE
    const mae = predictions.reduce((sum, pred, i) => sum + Math.abs(pred - actuals[i]), 0) / n;

    // RMSE
    const mse = predictions.reduce((sum, pred, i) => sum + Math.pow(pred - actuals[i], 2), 0) / n;
    const rmse = Math.sqrt(mse);

    // MAPE
    const mape = predictions.reduce((sum, pred, i) => {
      return sum + Math.abs((actuals[i] - pred) / actuals[i]);
    }, 0) / n * 100;

    // R²
    const actualMean = actuals.reduce((sum, val) => sum + val, 0) / n;
    const ssRes = predictions.reduce((sum, pred, i) => sum + Math.pow(actuals[i] - pred, 2), 0);
    const ssTot = actuals.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0);
    const r2 = 1 - (ssRes / ssTot);

    // Direction accuracy
    let correctDirections = 0;
    for (let i = 1; i < n; i++) {
      const predictedDirection = predictions[i] > predictions[i - 1];
      const actualDirection = actuals[i] > actuals[i - 1];
      if (predictedDirection === actualDirection) correctDirections++;
    }
    const accuracy = correctDirections / (n - 1);

    return { mae, rmse, mape, r2, accuracy };
  }

  /**
   * Extract features from candle data
   */
  private extractFeatures(candles: Candle[]): number[][] {
    const features: number[][] = [];

    for (let i = 0; i < candles.length; i++) {
      const feature: number[] = [];

      // Price features
      if (this.config.features.includes('close')) feature.push(candles[i].close);
      if (this.config.features.includes('open')) feature.push(candles[i].open);
      if (this.config.features.includes('high')) feature.push(candles[i].high);
      if (this.config.features.includes('low')) feature.push(candles[i].low);
      if (this.config.features.includes('volume')) feature.push(candles[i].volume);

      // Derived features
      if (this.config.features.includes('range')) {
        feature.push(candles[i].high - candles[i].low);
      }
      if (this.config.features.includes('body')) {
        feature.push(Math.abs(candles[i].close - candles[i].open));
      }
      if (this.config.features.includes('upperShadow')) {
        feature.push(candles[i].high - Math.max(candles[i].open, candles[i].close));
      }
      if (this.config.features.includes('lowerShadow')) {
        feature.push(Math.min(candles[i].open, candles[i].close) - candles[i].low);
      }

      // Returns
      if (this.config.features.includes('returns') && i > 0) {
        feature.push((candles[i].close - candles[i - 1].close) / candles[i - 1].close);
      } else if (this.config.features.includes('returns')) {
        feature.push(0);
      }

      features.push(feature);
    }

    return features;
  }

  private getFeatureValues(candles: Candle[]): Record<string, number> {
    const lastCandle = candles[candles.length - 1];
    const values: Record<string, number> = {};

    if (this.config.features.includes('close')) values.close = lastCandle.close;
    if (this.config.features.includes('volume')) values.volume = lastCandle.volume;
    if (this.config.features.includes('range')) values.range = lastCandle.high - lastCandle.low;

    return values;
  }

  getModelId(): string {
    return this.modelId;
  }

  getConfig(): ModelConfig {
    return { ...this.config };
  }

  isTrained(): boolean {
    return this.trainedAt > 0;
  }
}
