import type { Candle, DecisionResult, FinalSignal } from "./intelligence-engines.js";
import { computeTechnicalSnapshot, evaluateDecision, evaluateRiskScore } from "./intelligence-engines.js";

export interface Signal {
  symbol: string;
  signal: FinalSignal;
  confidence: number;
  riskScore: number;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  invalidationConditions: string[];
  shouldExecute: boolean;
  createdAt: string;
}

export interface SignalDetails extends Signal {
  technicalScore: number;
  technicalBias: string;
  indicators: Array<{
    name: string;
    value: number;
    bias: string;
    weight: number;
    explanation: string;
  }>;
  finalScore: number;
  explanation: string;
  topReasons: string[];
  dataQualityScore: number;
  providerDisagreementScore: number;
}

export interface GenerateSignalInput {
  symbol: string;
  candles: Candle[];
  currentPrice: number;
  newsScore: number;
  onchainScore: number;
  fundamentalScore: number;
  fearGreedScore?: number;
  marketStructureScore?: number;
  providerReliabilityScore?: number;
  dataQualityScore?: number;
  providerDisagreementScore?: number;
  atrPct?: number;
  liquidityScore?: number;
  spreadBps?: number;
  fundingRatePct?: number;
  openInterestChangePct?: number;
  requestedLeverage?: number;
}

export function generateRealSignal(input: GenerateSignalInput): Signal {
  // Compute technical snapshot from candles
  const technicalSnapshot = computeTechnicalSnapshot({
    symbol: input.symbol,
    timeframe: "1h",
    candles: input.candles
  });

  // Evaluate risk score
  const riskResult = evaluateRiskScore({
    atrPct: input.atrPct ?? 0.03,
    liquidityScore: input.liquidityScore ?? 70,
    spreadBps: input.spreadBps ?? 5,
    fundingRatePct: input.fundingRatePct ?? 0.01,
    openInterestChangePct: input.openInterestChangePct ?? 0,
    requestedLeverage: input.requestedLeverage ?? 3,
    btcCorrelation: 0.7,
    ethCorrelation: 0.6,
    criticalNews: false,
    onchainShock: false,
    strategyDrawdownPct: 0,
    providerDisagreementScore: input.providerDisagreementScore ?? 10,
    providerLatencyMs: 150
  });

  // Combine all scores using evaluateDecision
  const decision = evaluateDecision({
    technicalScore: technicalSnapshot.technicalScore,
    marketStructureScore: input.marketStructureScore ?? 50,
    newsScore: input.newsScore,
    onchainScore: input.onchainScore,
    fundamentalScore: input.fundamentalScore,
    fearGreedScore: input.fearGreedScore ?? 50,
    providerReliabilityScore: input.providerReliabilityScore ?? 85,
    riskScore: riskResult.riskScore,
    dataQualityScore: input.dataQualityScore ?? 75,
    providerDisagreementScore: input.providerDisagreementScore ?? 10
  });

  // Calculate entry, stop loss, and take profit based on signal
  let entryPrice: number | null = null;
  let stopLoss: number | null = null;
  let takeProfit: number | null = null;

  if (decision.finalSignal !== "WAIT") {
    entryPrice = input.currentPrice;
    const atr = input.currentPrice * (input.atrPct ?? 0.03);

    if (decision.finalSignal === "LONG") {
      stopLoss = round(entryPrice - atr * 1.5);
      takeProfit = round(entryPrice + atr * 2.5);
    } else if (decision.finalSignal === "SHORT") {
      stopLoss = round(entryPrice + atr * 1.5);
      takeProfit = round(entryPrice - atr * 2.5);
    }
  }

  return {
    symbol: input.symbol,
    signal: decision.finalSignal,
    confidence: decision.confidenceScore,
    riskScore: decision.riskScore,
    entryPrice,
    stopLoss,
    takeProfit,
    invalidationConditions: decision.invalidationConditions,
    shouldExecute: false, // Always false for safety until full validation
    createdAt: new Date().toISOString()
  };
}

export function generateSignalDetails(input: GenerateSignalInput): SignalDetails {
  // Compute technical snapshot
  const technicalSnapshot = computeTechnicalSnapshot({
    symbol: input.symbol,
    timeframe: "1h",
    candles: input.candles
  });

  // Evaluate risk score
  const riskResult = evaluateRiskScore({
    atrPct: input.atrPct ?? 0.03,
    liquidityScore: input.liquidityScore ?? 70,
    spreadBps: input.spreadBps ?? 5,
    fundingRatePct: input.fundingRatePct ?? 0.01,
    openInterestChangePct: input.openInterestChangePct ?? 0,
    requestedLeverage: input.requestedLeverage ?? 3,
    btcCorrelation: 0.7,
    ethCorrelation: 0.6,
    criticalNews: false,
    onchainShock: false,
    strategyDrawdownPct: 0,
    providerDisagreementScore: input.providerDisagreementScore ?? 10,
    providerLatencyMs: 150
  });

  // Combine all scores
  const decision = evaluateDecision({
    technicalScore: technicalSnapshot.technicalScore,
    marketStructureScore: input.marketStructureScore ?? 50,
    newsScore: input.newsScore,
    onchainScore: input.onchainScore,
    fundamentalScore: input.fundamentalScore,
    fearGreedScore: input.fearGreedScore ?? 50,
    providerReliabilityScore: input.providerReliabilityScore ?? 85,
    riskScore: riskResult.riskScore,
    dataQualityScore: input.dataQualityScore ?? 75,
    providerDisagreementScore: input.providerDisagreementScore ?? 10
  });

  // Calculate prices
  let entryPrice: number | null = null;
  let stopLoss: number | null = null;
  let takeProfit: number | null = null;

  if (decision.finalSignal !== "WAIT") {
    entryPrice = input.currentPrice;
    const atr = input.currentPrice * (input.atrPct ?? 0.03);

    if (decision.finalSignal === "LONG") {
      stopLoss = round(entryPrice - atr * 1.5);
      takeProfit = round(entryPrice + atr * 2.5);
    } else if (decision.finalSignal === "SHORT") {
      stopLoss = round(entryPrice + atr * 1.5);
      takeProfit = round(entryPrice - atr * 2.5);
    }
  }

  return {
    symbol: input.symbol,
    signal: decision.finalSignal,
    confidence: decision.confidenceScore,
    riskScore: decision.riskScore,
    entryPrice,
    stopLoss,
    takeProfit,
    invalidationConditions: decision.invalidationConditions,
    shouldExecute: false,
    createdAt: new Date().toISOString(),
    technicalScore: technicalSnapshot.technicalScore,
    technicalBias: technicalSnapshot.bias,
    indicators: technicalSnapshot.indicators,
    finalScore: decision.finalScore,
    explanation: decision.explanation,
    topReasons: decision.topReasons,
    dataQualityScore: decision.dataQualityScore,
    providerDisagreementScore: decision.providerDisagreementScore
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
