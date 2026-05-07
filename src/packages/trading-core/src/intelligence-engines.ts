export type Bias = "bullish" | "neutral" | "bearish";
export type FinalSignal = "LONG" | "SHORT" | "WAIT";
export type RiskLevel = "muito baixo" | "baixo" | "moderado" | "alto" | "extremo";
export type FearGreedLabel = "medo extremo" | "medo" | "neutro" | "ganância" | "ganância extrema";

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface TechnicalIndicatorResult {
  name: string;
  value: number;
  bias: Bias;
  weight: number;
  explanation: string;
}

export interface TechnicalSnapshot {
  symbol: string;
  timeframe: string;
  technicalScore: number;
  bias: Bias;
  indicators: TechnicalIndicatorResult[];
  explanation: string;
}

export interface RiskScoreInput {
  atrPct: number;
  liquidityScore: number;
  spreadBps: number;
  fundingRatePct: number;
  openInterestChangePct: number;
  requestedLeverage: number;
  btcCorrelation: number;
  ethCorrelation: number;
  criticalNews: boolean;
  onchainShock: boolean;
  strategyDrawdownPct: number;
  providerDisagreementScore: number;
  providerLatencyMs: number;
}

export interface RiskScoreResult {
  riskScore: number;
  riskLevel: RiskLevel;
  maxLeverageAllowed: number;
  recommendedAction: "ALLOW" | "REDUCE_RISK" | "WAIT";
  reasons: string[];
}

export interface DecisionInput {
  technicalScore: number;
  marketStructureScore: number;
  newsScore: number;
  onchainScore: number;
  fundamentalScore: number;
  fearGreedScore: number;
  providerReliabilityScore: number;
  riskScore: number;
  dataQualityScore: number;
  providerDisagreementScore: number;
}

export interface DecisionResult {
  finalSignal: FinalSignal;
  confidenceScore: number;
  riskScore: number;
  finalScore: number;
  explanation: string;
  topReasons: string[];
  invalidationConditions: string[];
  dataQualityScore: number;
  providerDisagreementScore: number;
}

export interface FearGreedInput {
  volatilityScore: number;
  momentumScore: number;
  volumeScore: number;
  btcDominanceScore: number;
  fundingScore: number;
  openInterestScore: number;
  newsSentimentScore: number;
  onchainScore: number;
  stablecoinFlowScore: number;
  technicalScore: number;
  correlationStressScore: number;
  dataQualityScore: number;
}

export interface FearGreedResult {
  fearGreedScore: number;
  label: FearGreedLabel;
  confidence: number;
  topPositiveFactors: string[];
  topNegativeFactors: string[];
  riskLevel: RiskLevel;
  explanation: string;
}

export interface NewsItemInput {
  title: string;
  source: string;
  publishedAt: string;
}

export interface NewsSentimentResult {
  score: number;
  confidence: number;
  events: string[];
  explanation: string;
}

export interface OnchainEventInput {
  classification: "EXCHANGE_INFLOW" | "EXCHANGE_OUTFLOW" | "ACCUMULATION" | "DISTRIBUTION" | "STABLECOIN_FLOW";
  valueUsd: number;
  asset: string;
  confidence: number;
}

export interface OnchainScoreResult {
  whaleScore: number;
  exchangeFlowScore: number;
  stablecoinFlowScore: number;
  onchainBias: Bias;
  confidence: number;
  explanation: string;
}

export interface FundamentalInput {
  marketCapUsd?: number;
  volume24hUsd?: number;
  liquidityScore?: number;
  tvlUsd?: number;
  developerActivityScore?: number;
  regulatoryRiskScore?: number;
}

export interface FundamentalResult {
  fundamentalScore: number;
  fundamentalBias: Bias;
  confidence: number;
  explanation: string;
}

export interface ProviderPriceSnapshot {
  provider: string;
  price: number;
  latencyMs: number;
  updatedAt: number;
  healthy: boolean;
}

export interface ProviderSetResult {
  recommendedProvider: string | null;
  reliabilityScore: number;
  disagreementScore: number;
  medianPrice: number | null;
  failoverOrder: string[];
}

export interface PaperTradeLike {
  pnl: number;
  pnlPercentage: number;
  openedAt: string;
  closedAt?: string;
}

export interface PaperMetrics {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  maxDrawdown: number;
  netPnl: number;
}

export function computeTechnicalSnapshot(input: {
  symbol: string;
  timeframe: string;
  candles: Candle[];
}): TechnicalSnapshot {
  const closes = input.candles.map((candle) => candle.close);
  const highs = input.candles.map((candle) => candle.high);
  const lows = input.candles.map((candle) => candle.low);
  const volumes = input.candles.map((candle) => candle.volume);
  const lastClose = closes.at(-1) ?? 0;
  const previousClose = closes.at(-2) ?? lastClose;
  const rsi = computeRsi(closes, 14);
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const bollinger = bollingerBands(closes, 20);
  const atr = averageTrueRange(input.candles, 14);
  const vwap = computeVwap(input.candles);
  const obv = computeObv(closes, volumes);
  const stochRsi = computeStochRsi(closes, 14);
  const adx = computeAdx(highs, lows, closes, 14);
  const fib = fibonacciPosition(closes);
  const macdValue = (ema(closes, 12) ?? lastClose) - (ema(closes, 26) ?? lastClose);

  const indicators: TechnicalIndicatorResult[] = [
    indicator("RSI", rsi, rsi > 58 ? "bullish" : rsi < 42 ? "bearish" : "neutral", 10, "Relative strength across recent closes"),
    indicator("MACD", macdValue, macdValue > 0 ? "bullish" : macdValue < 0 ? "bearish" : "neutral", 10, "EMA momentum spread"),
    indicator("EMA_9", ema9 ?? lastClose, lastClose >= (ema9 ?? lastClose) ? "bullish" : "bearish", 7, "Fast trend reference"),
    indicator("EMA_21", ema21 ?? lastClose, lastClose >= (ema21 ?? lastClose) ? "bullish" : "bearish", 7, "Short trend reference"),
    indicator("EMA_50", ema50 ?? lastClose, lastClose >= (ema50 ?? lastClose) ? "bullish" : "bearish", 6, "Medium trend reference"),
    indicator("SMA_20", sma20 ?? lastClose, lastClose >= (sma20 ?? lastClose) ? "bullish" : "bearish", 6, "Short mean reference"),
    indicator("SMA_50", sma50 ?? lastClose, lastClose >= (sma50 ?? lastClose) ? "bullish" : "bearish", 5, "Medium mean reference"),
    indicator("BOLLINGER_BANDS", bollinger.position, bollinger.position > 0.66 ? "bullish" : bollinger.position < 0.33 ? "bearish" : "neutral", 8, "Position inside volatility band"),
    indicator("ATR", atr, atr / Math.max(lastClose, 1) < 0.04 ? "bullish" : "neutral", 7, "Volatility pressure"),
    indicator("VWAP", vwap, lastClose >= vwap ? "bullish" : "bearish", 7, "Volume weighted price reference"),
    indicator("OBV", obv, lastClose >= previousClose && obv >= 0 ? "bullish" : "neutral", 6, "Volume confirmation"),
    indicator("STOCH_RSI", stochRsi, stochRsi > 70 ? "bullish" : stochRsi < 30 ? "bearish" : "neutral", 7, "RSI momentum location"),
    indicator("ADX", adx, adx >= 25 ? "bullish" : "neutral", 7, "Trend strength"),
    indicator("FIBONACCI_ZONE", fib, fib > 0.618 ? "bullish" : fib < 0.382 ? "bearish" : "neutral", 7, "Location inside recent high-low range")
  ];

  const weighted = indicators.reduce((total, item) => total + biasValue(item.bias) * item.weight, 0);
  const weights = indicators.reduce((total, item) => total + item.weight, 0);
  const technicalScore = clamp(Math.round((weighted / weights) * 100), 0, 100);
  const bias = scoreToBias(technicalScore);

  return {
    symbol: input.symbol,
    timeframe: input.timeframe,
    technicalScore,
    bias,
    indicators,
    explanation: `${input.symbol} ${input.timeframe} technical score ${technicalScore}/100 from ${indicators.length} indicators; bias is ${bias}.`
  };
}

export function evaluateRiskScore(input: RiskScoreInput): RiskScoreResult {
  const reasons: string[] = [];
  let score = 10;
  score += input.atrPct * 6;
  score += Math.max(0, 55 - input.liquidityScore) * 0.7;
  score += input.spreadBps * 0.45;
  score += Math.abs(input.fundingRatePct) * 120;
  score += Math.min(Math.abs(input.openInterestChangePct), 40) * 0.8;
  score += Math.max(0, input.requestedLeverage - 2) * 5;
  score += Math.max(input.btcCorrelation, input.ethCorrelation) > 0.85 ? 8 : 0;
  score += input.criticalNews ? 15 : 0;
  score += input.onchainShock ? 12 : 0;
  score += input.strategyDrawdownPct * 1.2;
  score += input.providerDisagreementScore * 0.8;
  score += input.providerLatencyMs > 1000 ? 8 : 0;

  if (input.criticalNews) reasons.push("Critical news is active");
  if (input.providerDisagreementScore > 25) reasons.push("Providers disagree on market state");
  if (input.requestedLeverage > 4) reasons.push("Requested leverage is high for paper validation");
  if (input.liquidityScore < 40) reasons.push("Liquidity is weak");

  const riskScore = clamp(Math.round(score), 0, 100);
  const riskLevel = riskLevelForScore(riskScore);
  return {
    riskScore,
    riskLevel,
    maxLeverageAllowed: riskScore > 75 ? 2 : riskScore > 60 ? 3 : riskScore > 40 ? 4 : 6,
    recommendedAction: riskScore > 75 ? "WAIT" : riskScore > 55 ? "REDUCE_RISK" : "ALLOW",
    reasons
  };
}

export function evaluateDecision(input: DecisionInput): DecisionResult {
  const finalScore = clamp(
    Math.round(
      input.technicalScore * 0.35 +
        input.marketStructureScore * 0.15 +
        input.newsScore * 0.15 +
        input.onchainScore * 0.15 +
        input.fundamentalScore * 0.1 +
        input.fearGreedScore * 0.05 +
        input.providerReliabilityScore * 0.05
    ),
    0,
    100
  );
  const invalidationConditions: string[] = [];
  if (input.dataQualityScore < 60) invalidationConditions.push("Data quality must recover before a directional signal is valid");
  if (input.providerDisagreementScore > 25) invalidationConditions.push("Provider disagreement must normalize");
  if (input.riskScore > 75) invalidationConditions.push("Risk score must fall below 75");

  const finalSignal: FinalSignal =
    invalidationConditions.length > 0 ? "WAIT" : finalScore >= 65 ? "LONG" : finalScore <= 35 ? "SHORT" : "WAIT";
  const confidenceScore = finalSignal === "WAIT" ? Math.min(input.dataQualityScore, 55) : Math.min(finalScore, 100);
  const topReasons = [
    `technical=${input.technicalScore}`,
    `news=${input.newsScore}`,
    `onchain=${input.onchainScore}`,
    `risk=${input.riskScore}`,
    `dataQuality=${input.dataQualityScore}`
  ];

  return {
    finalSignal,
    confidenceScore,
    riskScore: input.riskScore,
    finalScore,
    explanation: `${finalSignal} because final score is ${finalScore}, risk is ${input.riskScore}, and data quality is ${input.dataQualityScore}.`,
    topReasons,
    invalidationConditions,
    dataQualityScore: input.dataQualityScore,
    providerDisagreementScore: input.providerDisagreementScore
  };
}

export function computeFearGreedIndex(input: FearGreedInput): FearGreedResult {
  const score = clamp(
    Math.round(
      input.momentumScore * 0.14 +
        input.volumeScore * 0.1 +
        input.btcDominanceScore * 0.06 +
        input.fundingScore * 0.08 +
        input.openInterestScore * 0.08 +
        input.newsSentimentScore * 0.14 +
        input.onchainScore * 0.14 +
        input.stablecoinFlowScore * 0.08 +
        input.technicalScore * 0.12 +
        (100 - input.volatilityScore) * 0.04 +
        (100 - input.correlationStressScore) * 0.02
    ),
    0,
    100
  );
  const positives = Object.entries(input)
    .filter(([, value]) => value >= 65)
    .map(([key]) => key);
  const negatives = Object.entries(input)
    .filter(([, value]) => value <= 35)
    .map(([key]) => key);

  return {
    fearGreedScore: score,
    label: fearGreedLabel(score),
    confidence: clamp(Math.round(input.dataQualityScore), 0, 100),
    topPositiveFactors: positives,
    topNegativeFactors: negatives,
    riskLevel: riskLevelForScore(100 - score),
    explanation: `Fear/greed score ${score}/100 from market, news, on-chain, technical, and quality inputs.`
  };
}

export function scoreNewsSentiment(items: NewsItemInput[]): NewsSentimentResult {
  const negative = ["hack", "exploit", "lawsuit", "sec", "bankruptcy", "delist", "outage", "crash"];
  const positive = ["etf", "approval", "partnership", "listing", "upgrade", "adoption", "inflow"];
  let score = 0;
  const events: string[] = [];
  for (const item of items) {
    const title = item.title.toLowerCase();
    for (const word of negative) {
      if (title.includes(word)) {
        score -= 20;
        events.push(word);
      }
    }
    for (const word of positive) {
      if (title.includes(word)) {
        score += 15;
        events.push(word);
      }
    }
  }
  return {
    score: clamp(score, -100, 100),
    confidence: items.length ? clamp(50 + items.length * 8, 0, 90) : 0,
    events: [...new Set(events)],
    explanation: `${items.length} news items classified with keyword baseline.`
  };
}

export function scoreOnchainEvents(events: OnchainEventInput[]): OnchainScoreResult {
  let whale = 0;
  let exchange = 0;
  let stablecoin = 0;
  let confidenceTotal = 0;
  for (const event of events) {
    const impact = Math.min(event.valueUsd / 1_000_000, 50) * (event.confidence / 100);
    confidenceTotal += event.confidence;
    if (event.classification === "EXCHANGE_INFLOW") exchange -= impact;
    if (event.classification === "EXCHANGE_OUTFLOW") exchange += impact;
    if (event.classification === "ACCUMULATION") whale += impact;
    if (event.classification === "DISTRIBUTION") whale -= impact;
    if (event.classification === "STABLECOIN_FLOW") stablecoin += event.asset.match(/USDT|USDC|DAI/i) ? impact : 0;
  }
  const combined = (whale + exchange + stablecoin) / 3;
  return {
    whaleScore: clamp(Math.round(whale), -100, 100),
    exchangeFlowScore: clamp(Math.round(exchange), -100, 100),
    stablecoinFlowScore: clamp(Math.round(stablecoin), -100, 100),
    onchainBias: combined > 10 ? "bullish" : combined < -10 ? "bearish" : "neutral",
    confidence: events.length ? clamp(Math.round(confidenceTotal / events.length), 0, 100) : 0,
    explanation: `${events.length} on-chain events scored for whale, exchange flow, and stablecoin pressure.`
  };
}

export function scoreFundamentals(input: FundamentalInput): FundamentalResult {
  const liquidity = input.liquidityScore ?? 50;
  const sizeScore = input.marketCapUsd ? clamp(Math.log10(Math.max(input.marketCapUsd, 1)) * 8, 0, 100) : 50;
  const volumeToCap =
    input.marketCapUsd && input.volume24hUsd ? clamp((input.volume24hUsd / input.marketCapUsd) * 1000, 0, 100) : 50;
  const tvlScore = input.tvlUsd && input.marketCapUsd ? clamp((input.tvlUsd / input.marketCapUsd) * 300, 0, 100) : 50;
  const developer = input.developerActivityScore ?? 50;
  const regulatoryPenalty = input.regulatoryRiskScore ?? 20;
  const fundamentalScore = clamp(
    Math.round(sizeScore * 0.25 + liquidity * 0.3 + volumeToCap * 0.15 + tvlScore * 0.1 + developer * 0.25 - regulatoryPenalty * 0.05),
    0,
    100
  );
  return {
    fundamentalScore,
    fundamentalBias: scoreToBias(fundamentalScore),
    confidence: clamp(Math.round([input.marketCapUsd, input.volume24hUsd, input.liquidityScore, input.tvlUsd, input.developerActivityScore].filter(Boolean).length * 18), 0, 100),
    explanation: `Fundamental score ${fundamentalScore}/100 from liquidity, volume, TVL, developer activity, and regulatory risk.`
  };
}

export function evaluateProviderSet(snapshots: ProviderPriceSnapshot[]): ProviderSetResult {
  const healthy = snapshots.filter((snapshot) => snapshot.healthy && Number.isFinite(snapshot.price));
  if (healthy.length === 0) {
    return { recommendedProvider: null, reliabilityScore: 0, disagreementScore: 100, medianPrice: null, failoverOrder: [] };
  }
  const sortedPrices = healthy.map((snapshot) => snapshot.price).sort((a, b) => a - b);
  const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
  const maxDeviationPct = Math.max(...healthy.map((snapshot) => Math.abs(snapshot.price - medianPrice) / medianPrice)) * 100;
  const failoverOrder = [...healthy]
    .sort((a, b) => a.latencyMs - b.latencyMs)
    .map((snapshot) => snapshot.provider);
  const averageLatency = healthy.reduce((total, snapshot) => total + snapshot.latencyMs, 0) / healthy.length;
  return {
    recommendedProvider: failoverOrder[0] ?? null,
    reliabilityScore: clamp(Math.round(100 - maxDeviationPct * 8 - averageLatency / 50), 0, 100),
    disagreementScore: clamp(Math.round(maxDeviationPct * 5), 0, 100),
    medianPrice,
    failoverOrder
  };
}

export function calculatePaperMetrics(trades: PaperTradeLike[]): PaperMetrics {
  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl < 0);
  const grossProfit = wins.reduce((total, trade) => total + trade.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((total, trade) => total + trade.pnl, 0));
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const trade of trades) {
    equity += trade.pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }
  return {
    totalTrades: trades.length,
    winRate: trades.length ? round((wins.length / trades.length) * 100) : 0,
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? Number.POSITIVE_INFINITY : 0,
    averageWin: wins.length ? round(grossProfit / wins.length) : 0,
    averageLoss: losses.length ? round(grossLoss / losses.length) : 0,
    maxDrawdown: round(maxDrawdown),
    netPnl: round(trades.reduce((total, trade) => total + trade.pnl, 0))
  };
}

function indicator(name: string, value: number, bias: Bias, weight: number, explanation: string): TechnicalIndicatorResult {
  return { name, value: round(value), bias, weight, explanation };
}

function computeRsi(values: number[], period: number): number {
  if (values.length < 2) return 50;
  const changes = values.slice(1).map((value, index) => value - values[index]);
  const recent = changes.slice(-period);
  const gains = recent.filter((change) => change > 0).reduce((total, change) => total + change, 0) / period;
  const losses = Math.abs(recent.filter((change) => change < 0).reduce((total, change) => total + change, 0)) / period;
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}

function ema(values: number[], period: number): number | null {
  if (values.length === 0) return null;
  const multiplier = 2 / (period + 1);
  return values.reduce((previous, value) => value * multiplier + previous * (1 - multiplier), values[0]);
}

function sma(values: number[], period: number): number | null {
  const recent = values.slice(-period);
  if (recent.length === 0) return null;
  return recent.reduce((total, value) => total + value, 0) / recent.length;
}

function bollingerBands(values: number[], period: number): { position: number } {
  const recent = values.slice(-period);
  const mean = sma(recent, period) ?? values.at(-1) ?? 0;
  const variance = recent.reduce((total, value) => total + (value - mean) ** 2, 0) / Math.max(recent.length, 1);
  const deviation = Math.sqrt(variance);
  const upper = mean + deviation * 2;
  const lower = mean - deviation * 2;
  const last = values.at(-1) ?? mean;
  return { position: upper === lower ? 0.5 : clamp((last - lower) / (upper - lower), 0, 1) };
}

function averageTrueRange(candles: Candle[], period: number): number {
  const ranges = candles.map((candle, index) => {
    const previousClose = candles[index - 1]?.close ?? candle.close;
    return Math.max(candle.high - candle.low, Math.abs(candle.high - previousClose), Math.abs(candle.low - previousClose));
  });
  return sma(ranges, period) ?? 0;
}

function computeVwap(candles: Candle[]): number {
  const volume = candles.reduce((total, candle) => total + candle.volume, 0);
  if (volume === 0) return candles.at(-1)?.close ?? 0;
  return candles.reduce((total, candle) => total + ((candle.high + candle.low + candle.close) / 3) * candle.volume, 0) / volume;
}

function computeObv(closes: number[], volumes: number[]): number {
  let obv = 0;
  for (let index = 1; index < closes.length; index += 1) {
    if (closes[index] > closes[index - 1]) obv += volumes[index] ?? 0;
    if (closes[index] < closes[index - 1]) obv -= volumes[index] ?? 0;
  }
  return obv;
}

function computeStochRsi(values: number[], period: number): number {
  const rsiSeries = values.map((_, index) => computeRsi(values.slice(0, index + 1), period));
  const recent = rsiSeries.slice(-period);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const last = recent.at(-1) ?? 50;
  return max === min ? 50 : ((last - min) / (max - min)) * 100;
}

function computeAdx(highs: number[], lows: number[], closes: number[], period: number): number {
  const moves = highs.slice(1).map((high, index) => Math.abs(high - highs[index]) + Math.abs(lows[index + 1] - lows[index]));
  const atrProxy = averageTrueRange(
    highs.map((high, index) => ({ high, low: lows[index], close: closes[index], open: closes[index], volume: 0, timestamp: index })),
    period
  );
  const movement = sma(moves, period) ?? 0;
  return atrProxy === 0 ? 0 : clamp((movement / atrProxy) * 25, 0, 100);
}

function fibonacciPosition(values: number[]): number {
  const high = Math.max(...values);
  const low = Math.min(...values);
  const last = values.at(-1) ?? 0;
  return high === low ? 0.5 : clamp((last - low) / (high - low), 0, 1);
}

function scoreToBias(score: number): Bias {
  if (score >= 60) return "bullish";
  if (score <= 40) return "bearish";
  return "neutral";
}

function biasValue(bias: Bias): number {
  if (bias === "bullish") return 1;
  if (bias === "bearish") return 0;
  return 0.5;
}

function fearGreedLabel(score: number): FearGreedLabel {
  if (score <= 20) return "medo extremo";
  if (score <= 40) return "medo";
  if (score <= 60) return "neutro";
  if (score <= 80) return "ganância";
  return "ganância extrema";
}

function riskLevelForScore(score: number): RiskLevel {
  if (score <= 20) return "muito baixo";
  if (score <= 40) return "baixo";
  if (score <= 60) return "moderado";
  if (score <= 80) return "alto";
  return "extremo";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
