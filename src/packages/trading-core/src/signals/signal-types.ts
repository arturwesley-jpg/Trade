/**
 * Signal Type Definitions
 */

export type SignalType = 'buy' | 'sell' | 'hold';
export type SignalStrength = 'strong' | 'moderate' | 'weak';

export interface IndicatorSignal {
  value: number;
  signal: string;
  weight?: number;
}

export interface TradingSignal {
  symbol: string;
  type: SignalType;
  strength: SignalStrength;
  confidence: number; // 0-100
  price: number;
  indicators: {
    rsi?: IndicatorSignal;
    macd?: IndicatorSignal;
    ma?: IndicatorSignal;
    bollinger?: IndicatorSignal;
    stochastic?: IndicatorSignal;
    obv?: IndicatorSignal;
    adx?: IndicatorSignal;
    atr?: IndicatorSignal;
    supportResistance?: IndicatorSignal;
  };
  sentiment?: {
    score: number; // -1 to 1
    classification: string;
    confidence: number;
    components?: {
      news?: number;
      fearGreed?: number;
      social?: number;
      whales?: number;
    };
  };
  reasoning: string[];
  timestamp: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskReward?: number;
}

export interface SignalGenerationOptions {
  symbol: string;
  includeRiskLevels?: boolean;
  minConfidence?: number;
  sentimentWeight?: number;
  technicalWeight?: number;
}

export interface SignalHistory {
  signals: TradingSignal[];
  performance?: {
    totalSignals: number;
    profitable: number;
    unprofitable: number;
    winRate: number;
    avgReturn: number;
  };
}
