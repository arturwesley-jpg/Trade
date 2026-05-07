/**
 * ML API Routes
 * Provides endpoints for price prediction, pattern detection, and model management
 */

import { Router, type Request, type Response } from 'express';
import {
  PricePredictor,
  PatternRecognition,
  ModelManager,
  FeatureEngineering,
  type ModelConfig,
  type Prediction
} from '@trade/ml';
import type { Candle } from '@trade/shared';
import { logger } from '@trade/shared';

const router = Router();
const modelManager = new ModelManager('./models');

// Initialize model manager
modelManager.initialize().catch(err => {
  logger.error('Failed to initialize model manager', { error: err });
});

/**
 * POST /api/ml/predict/:symbol
 * Get price prediction for a symbol
 */
router.post('/predict/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { candles, horizon } = req.body as { candles: Candle[]; horizon?: number };

    if (!candles || !Array.isArray(candles) || candles.length === 0) {
      return res.status(400).json({ error: 'Valid candles array required' });
    }

    // Use model manager for prediction
    const prediction = await modelManager.predict(symbol.toUpperCase(), candles);

    logger.info('Price prediction generated', {
      symbol,
      modelId: prediction.modelId,
      direction: prediction.direction,
      confidence: prediction.confidence
    });

    res.json({
      success: true,
      prediction
    });
  } catch (error) {
    logger.error('Price prediction failed', { error });
    res.status(500).json({
      error: 'Failed to generate prediction',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ml/patterns/:symbol
 * Detect chart and candlestick patterns
 */
router.get('/patterns/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { candles } = req.query;

    if (!candles) {
      return res.status(400).json({ error: 'Candles data required' });
    }

    const candleData: Candle[] = JSON.parse(candles as string);

    // Detect patterns
    const chartPatterns = PatternRecognition.detectChartPatterns(candleData);
    const candlestickPatterns = PatternRecognition.detectCandlestickPatterns(candleData);
    const supportResistance = PatternRecognition.detectSupportResistance(candleData);
    const trend = PatternRecognition.detectTrend(candleData);

    logger.info('Pattern detection completed', {
      symbol,
      chartPatterns: chartPatterns.length,
      candlestickPatterns: candlestickPatterns.length,
      supportResistanceLevels: supportResistance.length
    });

    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      patterns: {
        chart: chartPatterns,
        candlestick: candlestickPatterns,
        supportResistance,
        trend
      }
    });
  } catch (error) {
    logger.error('Pattern detection failed', { error });
    res.status(500).json({
      error: 'Failed to detect patterns',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ml/models
 * List all available models
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const { symbol, modelType, status } = req.query;

    let versions = modelManager.getVersions(
      symbol as string | undefined,
      modelType as string | undefined
    );

    if (status) {
      versions = versions.filter(v => v.status === status);
    }

    const activeModel = modelManager.getActiveModel();
    const abTest = modelManager.getABTestStatus();

    res.json({
      success: true,
      activeModel,
      abTest,
      models: versions
    });
  } catch (error) {
    logger.error('Failed to list models', { error });
    res.status(500).json({
      error: 'Failed to list models',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ml/train
 * Train a new model
 */
router.post('/train', async (req: Request, res: Response) => {
  try {
    const { symbol, config, trainingData } = req.body as {
      symbol: string;
      config: ModelConfig;
      trainingData: Candle[];
    };

    if (!symbol || !config || !trainingData) {
      return res.status(400).json({
        error: 'Symbol, config, and trainingData required'
      });
    }

    // Validate config
    if (!['lstm', 'rf', 'gbm'].includes(config.modelType)) {
      return res.status(400).json({
        error: 'Invalid model type. Must be lstm, rf, or gbm'
      });
    }

    logger.info('Starting model training', {
      symbol,
      modelType: config.modelType,
      dataPoints: trainingData.length
    });

    // Train model
    const version = await modelManager.trainModel(config, trainingData, symbol.toUpperCase());

    logger.info('Model training completed', {
      modelId: version.id,
      metrics: version.metrics
    });

    res.json({
      success: true,
      model: version
    });
  } catch (error) {
    logger.error('Model training failed', { error });
    res.status(500).json({
      error: 'Failed to train model',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ml/deploy/:modelId
 * Deploy a model to production
 */
router.post('/deploy/:modelId', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;

    await modelManager.deployModel(modelId);

    logger.info('Model deployed', { modelId });

    res.json({
      success: true,
      message: `Model ${modelId} deployed successfully`
    });
  } catch (error) {
    logger.error('Model deployment failed', { error });
    res.status(500).json({
      error: 'Failed to deploy model',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ml/evaluate/:modelId
 * Evaluate model on test data
 */
router.post('/evaluate/:modelId', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const { testData } = req.body as { testData: Candle[] };

    if (!testData || !Array.isArray(testData)) {
      return res.status(400).json({ error: 'Valid test data required' });
    }

    const metrics = await modelManager.evaluateModel(modelId, testData);

    logger.info('Model evaluation completed', { modelId, metrics });

    res.json({
      success: true,
      modelId,
      metrics
    });
  } catch (error) {
    logger.error('Model evaluation failed', { error });
    res.status(500).json({
      error: 'Failed to evaluate model',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ml/abtest/start
 * Start A/B test between two models
 */
router.post('/abtest/start', async (req: Request, res: Response) => {
  try {
    const { modelAId, modelBId, trafficSplit, durationHours } = req.body as {
      modelAId: string;
      modelBId: string;
      trafficSplit?: number;
      durationHours?: number;
    };

    if (!modelAId || !modelBId) {
      return res.status(400).json({ error: 'Both model IDs required' });
    }

    const abTest = await modelManager.startABTest(
      modelAId,
      modelBId,
      trafficSplit,
      durationHours
    );

    logger.info('A/B test started', { modelAId, modelBId, trafficSplit });

    res.json({
      success: true,
      abTest
    });
  } catch (error) {
    logger.error('Failed to start A/B test', { error });
    res.status(500).json({
      error: 'Failed to start A/B test',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ml/abtest/stop
 * Stop A/B test and select winner
 */
router.post('/abtest/stop', async (req: Request, res: Response) => {
  try {
    const { deployWinner } = req.body as { deployWinner?: boolean };

    const result = await modelManager.stopABTest(deployWinner ?? true);

    logger.info('A/B test stopped', { winner: result.winner });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('Failed to stop A/B test', { error });
    res.status(500).json({
      error: 'Failed to stop A/B test',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ml/abtest/status
 * Get A/B test status
 */
router.get('/abtest/status', async (req: Request, res: Response) => {
  try {
    const abTest = modelManager.getABTestStatus();

    res.json({
      success: true,
      abTest: abTest || null,
      active: abTest !== null
    });
  } catch (error) {
    logger.error('Failed to get A/B test status', { error });
    res.status(500).json({
      error: 'Failed to get A/B test status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ml/features/extract
 * Extract features from candle data
 */
router.post('/features/extract', async (req: Request, res: Response) => {
  try {
    const { candles, config } = req.body as {
      candles: Candle[];
      config?: {
        includeTechnicalIndicators?: boolean;
        includeVolumeFeatures?: boolean;
        includePriceFeatures?: boolean;
        includeTimeFeatures?: boolean;
      };
    };

    if (!candles || !Array.isArray(candles)) {
      return res.status(400).json({ error: 'Valid candles array required' });
    }

    const featureEngineering = new FeatureEngineering(config);
    const features = featureEngineering.extractFeatures(candles);

    res.json({
      success: true,
      features,
      count: features.length
    });
  } catch (error) {
    logger.error('Feature extraction failed', { error });
    res.status(500).json({
      error: 'Failed to extract features',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;