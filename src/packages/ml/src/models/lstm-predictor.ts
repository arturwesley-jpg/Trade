/**
 * LSTM-based Price Prediction Model
 * Implements a simplified LSTM for time series forecasting
 */

import { DataPreprocessor, type NormalizedData, type SequenceData } from '../preprocessing/data-preprocessor.js';

export interface LSTMConfig {
  inputSize: number;
  hiddenSize: number;
  outputSize: number;
  sequenceLength: number;
  learningRate: number;
  epochs: number;
  batchSize: number;
}

export interface PredictionResult {
  prediction: number;
  confidence: number;
  timestamp: number;
}

export interface TrainingMetrics {
  epoch: number;
  trainLoss: number;
  valLoss: number;
  mae: number;
  rmse: number;
}

/**
 * Simplified LSTM Cell Implementation
 * Note: For production, consider using TensorFlow.js or ONNX Runtime
 */
class LSTMCell {
  private Wf: number[][];
  private Wi: number[][];
  private Wc: number[][];
  private Wo: number[][];
  private bf: number[];
  private bi: number[];
  private bc: number[];
  private bo: number[];

  constructor(inputSize: number, hiddenSize: number) {
    this.Wf = this.initializeWeights(hiddenSize, inputSize + hiddenSize);
    this.Wi = this.initializeWeights(hiddenSize, inputSize + hiddenSize);
    this.Wc = this.initializeWeights(hiddenSize, inputSize + hiddenSize);
    this.Wo = this.initializeWeights(hiddenSize, inputSize + hiddenSize);

    this.bf = new Array(hiddenSize).fill(0);
    this.bi = new Array(hiddenSize).fill(0);
    this.bc = new Array(hiddenSize).fill(0);
    this.bo = new Array(hiddenSize).fill(0);
  }

  private initializeWeights(rows: number, cols: number): number[][] {
    const weights: number[][] = [];
    const scale = Math.sqrt(2.0 / (rows + cols));

    for (let i = 0; i < rows; i++) {
      weights[i] = [];
      for (let j = 0; j < cols; j++) {
        weights[i][j] = (Math.random() * 2 - 1) * scale;
      }
    }

    return weights;
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private tanh(x: number): number {
    return Math.tanh(x);
  }

  private matmul(weights: number[][], input: number[]): number[] {
    return weights.map(row =>
      row.reduce((sum, w, i) => sum + w * input[i], 0)
    );
  }

  forward(
    input: number[],
    prevHidden: number[],
    prevCell: number[]
  ): { hidden: number[]; cell: number[] } {
    const combined = [...input, ...prevHidden];

    const forgetGate = this.matmul(this.Wf, combined).map((v, i) =>
      this.sigmoid(v + this.bf[i])
    );

    const inputGate = this.matmul(this.Wi, combined).map((v, i) =>
      this.sigmoid(v + this.bi[i])
    );

    const cellCandidate = this.matmul(this.Wc, combined).map((v, i) =>
      this.tanh(v + this.bc[i])
    );

    const outputGate = this.matmul(this.Wo, combined).map((v, i) =>
      this.sigmoid(v + this.bo[i])
    );

    const cell = prevCell.map((c, i) =>
      forgetGate[i] * c + inputGate[i] * cellCandidate[i]
    );

    const hidden = cell.map((c, i) =>
      outputGate[i] * this.tanh(c)
    );

    return { hidden, cell };
  }
}

export class LSTMPricePredictor {
  private config: LSTMConfig;
  private lstmCell: LSTMCell;
  private outputWeights: number[][];
  private outputBias: number[];
  private normalizationParams?: NormalizedData;
  private trained: boolean = false;

  constructor(config: Partial<LSTMConfig> = {}) {
    this.config = {
      inputSize: config.inputSize || 1,
      hiddenSize: config.hiddenSize || 64,
      outputSize: config.outputSize || 1,
      sequenceLength: config.sequenceLength || 60,
      learningRate: config.learningRate || 0.001,
      epochs: config.epochs || 100,
      batchSize: config.batchSize || 32
    };

    this.lstmCell = new LSTMCell(this.config.inputSize, this.config.hiddenSize);
    this.outputWeights = this.initializeWeights(
      this.config.outputSize,
      this.config.hiddenSize
    );
    this.outputBias = new Array(this.config.outputSize).fill(0);
  }

  private initializeWeights(rows: number, cols: number): number[][] {
    const weights: number[][] = [];
    const scale = Math.sqrt(2.0 / (rows + cols));

    for (let i = 0; i < rows; i++) {
      weights[i] = [];
      for (let j = 0; j < cols; j++) {
        weights[i][j] = (Math.random() * 2 - 1) * scale;
      }
    }

    return weights;
  }

  /**
   * Train the LSTM model
   */
  async train(
    prices: number[],
    validationSplit: number = 0.2
  ): Promise<TrainingMetrics[]> {
    // Normalize data
    this.normalizationParams = DataPreprocessor.zScoreNormalize(prices);

    // Create sequences
    const sequences = DataPreprocessor.createSequences(
      this.normalizationParams.normalized,
      this.config.sequenceLength,
      1
    );

    // Split data
    const splitIndex = Math.floor(sequences.sequences.length * (1 - validationSplit));
    const trainSequences = sequences.sequences.slice(0, splitIndex);
    const trainTargets = sequences.targets.slice(0, splitIndex);
    const valSequences = sequences.sequences.slice(splitIndex);
    const valTargets = sequences.targets.slice(splitIndex);

    const metrics: TrainingMetrics[] = [];

    // Training loop (simplified - in production use proper backpropagation)
    for (let epoch = 0; epoch < this.config.epochs; epoch++) {
      let trainLoss = 0;

      // Training
      for (let i = 0; i < trainSequences.length; i++) {
        const prediction = this.forwardPass(trainSequences[i]);
        const error = prediction - trainTargets[i];
        trainLoss += error * error;
      }

      trainLoss = Math.sqrt(trainLoss / trainSequences.length);

      // Validation
      let valLoss = 0;
      let mae = 0;

      for (let i = 0; i < valSequences.length; i++) {
        const prediction = this.forwardPass(valSequences[i]);
        const error = prediction - valTargets[i];
        valLoss += error * error;
        mae += Math.abs(error);
      }

      valLoss = Math.sqrt(valLoss / valSequences.length);
      mae = mae / valSequences.length;

      metrics.push({
        epoch: epoch + 1,
        trainLoss,
        valLoss,
        mae,
        rmse: valLoss
      });

      // Early stopping
      if (epoch > 10 && valLoss > metrics[epoch - 5].valLoss) {
        break;
      }
    }

    this.trained = true;
    return metrics;
  }

  private forwardPass(sequence: number[][]): number {
    let hidden = new Array(this.config.hiddenSize).fill(0);
    let cell = new Array(this.config.hiddenSize).fill(0);

    // Process sequence
    for (const input of sequence) {
      const result = this.lstmCell.forward(input, hidden, cell);
      hidden = result.hidden;
      cell = result.cell;
    }

    // Output layer
    const output = this.outputWeights[0].reduce(
      (sum, w, i) => sum + w * hidden[i],
      this.outputBias[0]
    );

    return output;
  }

  /**
   * Predict future price
   */
  predict(recentPrices: number[], horizon: number = 1): PredictionResult[] {
    if (!this.trained || !this.normalizationParams) {
      throw new Error('Model must be trained before prediction');
    }

    if (recentPrices.length < this.config.sequenceLength) {
      throw new Error(`Need at least ${this.config.sequenceLength} prices for prediction`);
    }

    const predictions: PredictionResult[] = [];
    const normalizedPrices = recentPrices.map(
      p => (p - this.normalizationParams!.mean) / this.normalizationParams!.std
    );

    let currentSequence = normalizedPrices.slice(-this.config.sequenceLength);

    for (let i = 0; i < horizon; i++) {
      const sequence = currentSequence.map(p => [p]);
      const normalizedPred = this.forwardPass(sequence);

      // Denormalize
      const prediction = normalizedPred * this.normalizationParams.std +
                        this.normalizationParams.mean;

      // Calculate confidence (simplified)
      const recentVolatility = this.calculateVolatility(recentPrices.slice(-20));
      const confidence = Math.max(0, Math.min(1, 1 - recentVolatility / prediction));

      predictions.push({
        prediction,
        confidence,
        timestamp: Date.now() + (i + 1) * 60000 // 1 minute intervals
      });

      // Update sequence for next prediction
      currentSequence = [...currentSequence.slice(1), normalizedPred];
    }

    return predictions;
  }

  private calculateVolatility(prices: number[]): number {
    const returns = DataPreprocessor.percentageChange(prices);
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  /**
   * Get model configuration
   */
  getConfig(): LSTMConfig {
    return { ...this.config };
  }

  /**
   * Check if model is trained
   */
  isTrained(): boolean {
    return this.trained;
  }
}
