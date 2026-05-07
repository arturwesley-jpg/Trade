/**
 * Exemplo de uso do sistema de métricas avançadas
 *
 * Este arquivo demonstra como usar as três classes principais:
 * - MetricsCalculator: Métricas core de performance
 * - TimeSeriesAnalyzer: Análise temporal e equity curve
 * - RiskAnalyzer: Métricas de risco e position sizing
 */

import {
  TimeSeriesAnalyzer,
  RiskAnalyzer,
  type TradeMetrics
} from "../index.js";
import { MetricsCalculator } from "./metrics-calculator.js";

// Dados de exemplo: 20 trades simuladas
const exampleTrades: TradeMetrics[] = [
  { pnl: 150, pnlPercentage: 1.5, openedAt: "2024-01-01T10:00:00Z", closedAt: "2024-01-01T14:00:00Z" },
  { pnl: -80, pnlPercentage: -0.8, openedAt: "2024-01-02T10:00:00Z", closedAt: "2024-01-02T12:00:00Z" },
  { pnl: 200, pnlPercentage: 2.0, openedAt: "2024-01-03T10:00:00Z", closedAt: "2024-01-03T16:00:00Z" },
  { pnl: 120, pnlPercentage: 1.2, openedAt: "2024-01-04T10:00:00Z", closedAt: "2024-01-04T13:00:00Z" },
  { pnl: -50, pnlPercentage: -0.5, openedAt: "2024-01-05T10:00:00Z", closedAt: "2024-01-05T11:00:00Z" },
  { pnl: 180, pnlPercentage: 1.8, openedAt: "2024-01-06T10:00:00Z", closedAt: "2024-01-06T15:00:00Z" },
  { pnl: 90, pnlPercentage: 0.9, openedAt: "2024-01-07T10:00:00Z", closedAt: "2024-01-07T12:00:00Z" },
  { pnl: -100, pnlPercentage: -1.0, openedAt: "2024-01-08T10:00:00Z", closedAt: "2024-01-08T11:00:00Z" },
  { pnl: 250, pnlPercentage: 2.5, openedAt: "2024-01-09T10:00:00Z", closedAt: "2024-01-09T17:00:00Z" },
  { pnl: 130, pnlPercentage: 1.3, openedAt: "2024-01-10T10:00:00Z", closedAt: "2024-01-10T14:00:00Z" }
];

console.log("=== EXEMPLO DE USO - SISTEMA DE MÉTRICAS ===\n");

// 1. Métricas de Performance
const metricsCalculator = new MetricsCalculator({
  initialCapital: 10_000,
  riskFreeRate: 0.02
});

const performance = metricsCalculator.calculate(exampleTrades);
console.log("Performance Metrics:");
console.log(`  Sharpe Ratio: ${performance.sharpeRatio}`);
console.log(`  Win Rate: ${performance.winRate}%`);
console.log(`  Total Return: $${performance.totalReturn}\n`);

// 2. Análise Temporal
const timeSeriesAnalyzer = new TimeSeriesAnalyzer({
  initialCapital: 10_000,
  rollingWindowDays: 7
});

const timeSeries = timeSeriesAnalyzer.analyze(exampleTrades);
console.log("Time Series Analytics:");
console.log(`  Equity Curve Points: ${timeSeries.equityCurve.length}`);
console.log(`  Drawdown Periods: ${timeSeries.drawdownPeriods.length}\n`);

// 3. Análise de Risco
const riskAnalyzer = new RiskAnalyzer({
  initialCapital: 10_000,
  kellyFractionMultiplier: 0.25
});

const risk = riskAnalyzer.analyze(exampleTrades);
console.log("Risk Metrics:");
console.log(`  VaR 95%: $${risk.var95}`);
console.log(`  Recommended Position Size: $${risk.recommendedPositionSize}`);
