import { describe, expect, it } from "vitest";
import {
  calculatePaperMetrics,
  computeFearGreedIndex,
  computeTechnicalSnapshot,
  evaluateDecision,
  evaluateProviderSet,
  evaluateRiskScore,
  scoreFundamentals,
  scoreNewsSentiment,
  scoreOnchainEvents
} from "./intelligence-engines.js";

const candles = [
  { open: 100, high: 106, low: 98, close: 104, volume: 1000, timestamp: 1 },
  { open: 104, high: 108, low: 102, close: 107, volume: 1300, timestamp: 2 },
  { open: 107, high: 109, low: 101, close: 103, volume: 1600, timestamp: 3 },
  { open: 103, high: 111, low: 102, close: 110, volume: 2200, timestamp: 4 },
  { open: 110, high: 116, low: 109, close: 115, volume: 2600, timestamp: 5 },
  { open: 115, high: 119, low: 112, close: 114, volume: 2100, timestamp: 6 },
  { open: 114, high: 121, low: 113, close: 120, volume: 2800, timestamp: 7 },
  { open: 120, high: 124, low: 118, close: 123, volume: 3200, timestamp: 8 },
  { open: 123, high: 125, low: 117, close: 119, volume: 3000, timestamp: 9 },
  { open: 119, high: 127, low: 118, close: 126, volume: 3600, timestamp: 10 },
  { open: 126, high: 130, low: 124, close: 129, volume: 3900, timestamp: 11 },
  { open: 129, high: 132, low: 125, close: 128, volume: 3500, timestamp: 12 },
  { open: 128, high: 134, low: 127, close: 133, volume: 4200, timestamp: 13 },
  { open: 133, high: 138, low: 131, close: 136, volume: 4600, timestamp: 14 },
  { open: 136, high: 141, low: 134, close: 139, volume: 5000, timestamp: 15 }
];

describe("intelligence engines", () => {
  it("computes at least ten technical indicators and a bounded technical score", () => {
    const snapshot = computeTechnicalSnapshot({ symbol: "BTC-USDT", timeframe: "1h", candles });

    expect(snapshot.indicators.map((indicator) => indicator.name)).toEqual(
      expect.arrayContaining(["RSI", "MACD", "EMA_9", "SMA_20", "BOLLINGER_BANDS", "ATR", "VWAP", "OBV", "STOCH_RSI", "ADX"])
    );
    expect(snapshot.indicators.length).toBeGreaterThanOrEqual(10);
    expect(snapshot.technicalScore).toBeGreaterThanOrEqual(0);
    expect(snapshot.technicalScore).toBeLessThanOrEqual(100);
    expect(snapshot.explanation.length).toBeGreaterThan(10);
  });

  it("pushes high-risk contexts toward WAIT and lower leverage", () => {
    const risk = evaluateRiskScore({
      atrPct: 6,
      liquidityScore: 25,
      spreadBps: 45,
      fundingRatePct: 0.18,
      openInterestChangePct: 22,
      requestedLeverage: 8,
      btcCorrelation: 0.91,
      ethCorrelation: 0.84,
      criticalNews: true,
      onchainShock: true,
      strategyDrawdownPct: 18,
      providerDisagreementScore: 42,
      providerLatencyMs: 1800
    });

    expect(risk.riskScore).toBeGreaterThan(75);
    expect(risk.recommendedAction).toBe("WAIT");
    expect(risk.maxLeverageAllowed).toBeLessThanOrEqual(2);
  });

  it("emits WAIT when providers disagree or data quality is weak", () => {
    const decision = evaluateDecision({
      technicalScore: 78,
      marketStructureScore: 70,
      newsScore: 65,
      onchainScore: 61,
      fundamentalScore: 58,
      fearGreedScore: 68,
      providerReliabilityScore: 45,
      riskScore: 82,
      dataQualityScore: 48,
      providerDisagreementScore: 38
    });

    expect(decision.finalSignal).toBe("WAIT");
    expect(decision.invalidationConditions).toContain("Data quality must recover before a directional signal is valid");
    expect(decision.explanation).toContain("WAIT");
  });

  it("builds a proprietary fear and greed index from multiple factors", () => {
    const index = computeFearGreedIndex({
      volatilityScore: 25,
      momentumScore: 80,
      volumeScore: 72,
      btcDominanceScore: 60,
      fundingScore: 55,
      openInterestScore: 65,
      newsSentimentScore: 70,
      onchainScore: 62,
      stablecoinFlowScore: 68,
      technicalScore: 76,
      correlationStressScore: 30,
      dataQualityScore: 88
    });

    expect(index.fearGreedScore).toBeGreaterThan(60);
    expect(index.label).toBe("ganância");
    expect(index.topPositiveFactors.length).toBeGreaterThan(0);
  });

  it("scores news, on-chain events, fundamentals, providers, and paper metrics", () => {
    expect(scoreNewsSentiment([{ title: "Major exchange hack hits BTC liquidity", source: "CoinDesk", publishedAt: "2026-05-02T12:00:00Z" }]).score).toBeLessThan(0);
    expect(scoreOnchainEvents([{ classification: "EXCHANGE_INFLOW", valueUsd: 25_000_000, asset: "BTC", confidence: 90 }]).exchangeFlowScore).toBeLessThan(0);
    expect(scoreFundamentals({ marketCapUsd: 800_000_000_000, volume24hUsd: 25_000_000_000, liquidityScore: 92, tvlUsd: 20_000_000_000, developerActivityScore: 80 }).fundamentalScore).toBeGreaterThan(70);

    const provider = evaluateProviderSet([
      { provider: "binance", price: 100, latencyMs: 80, updatedAt: 1000, healthy: true },
      { provider: "bybit", price: 101, latencyMs: 140, updatedAt: 1000, healthy: true },
      { provider: "kraken", price: 100.4, latencyMs: 220, updatedAt: 1000, healthy: true }
    ]);
    expect(provider.recommendedProvider).toBe("binance");
    expect(provider.disagreementScore).toBeLessThan(5);

    const metrics = calculatePaperMetrics([
      { pnl: 12, pnlPercentage: 3, openedAt: "a", closedAt: "b" },
      { pnl: -4, pnlPercentage: -1, openedAt: "c", closedAt: "d" },
      { pnl: 8, pnlPercentage: 2, openedAt: "e", closedAt: "f" }
    ]);
    expect(metrics.winRate).toBeCloseTo(66.67, 2);
    expect(metrics.profitFactor).toBe(5);
  });
});
