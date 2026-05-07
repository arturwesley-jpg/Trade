import { describe, it, expect } from "vitest";
import { MetricsCalculator, type TradeMetrics } from "./metrics-calculator.js";

describe("MetricsCalculator", () => {
  const calculator = new MetricsCalculator({ initialCapital: 10_000, riskFreeRate: 0.02 });

  it("should return empty metrics for no trades", () => {
    const metrics = calculator.calculate([]);
    expect(metrics.totalTrades).toBe(0);
    expect(metrics.totalReturn).toBe(0);
    expect(metrics.winRate).toBe(0);
  });

  it("should calculate basic win rate correctly", () => {
    const trades: TradeMetrics[] = [
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-01T00:00:00Z", closedAt: "2024-01-01T01:00:00Z" },
      { pnl: -50, pnlPercentage: -0.5, openedAt: "2024-01-02T00:00:00Z", closedAt: "2024-01-02T01:00:00Z" },
      { pnl: 200, pnlPercentage: 2, openedAt: "2024-01-03T00:00:00Z", closedAt: "2024-01-03T01:00:00Z" },
      { pnl: 150, pnlPercentage: 1.5, openedAt: "2024-01-04T00:00:00Z", closedAt: "2024-01-04T01:00:00Z" }
    ];

    const metrics = calculator.calculate(trades);
    expect(metrics.totalTrades).toBe(4);
    expect(metrics.winningTrades).toBe(3);
    expect(metrics.losingTrades).toBe(1);
    expect(metrics.winRate).toBe(75);
  });

  it("should calculate total return correctly", () => {
    const trades: TradeMetrics[] = [
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-01T00:00:00Z", closedAt: "2024-01-01T01:00:00Z" },
      { pnl: -50, pnlPercentage: -0.5, openedAt: "2024-01-02T00:00:00Z", closedAt: "2024-01-02T01:00:00Z" },
      { pnl: 200, pnlPercentage: 2, openedAt: "2024-01-03T00:00:00Z", closedAt: "2024-01-03T01:00:00Z" }
    ];

    const metrics = calculator.calculate(trades);
    expect(metrics.totalReturn).toBe(250);
    expect(metrics.totalReturnPct).toBe(2.5);
  });

  it("should calculate profit factor correctly", () => {
    const trades: TradeMetrics[] = [
      { pnl: 300, pnlPercentage: 3, openedAt: "2024-01-01T00:00:00Z", closedAt: "2024-01-01T01:00:00Z" },
      { pnl: -100, pnlPercentage: -1, openedAt: "2024-01-02T00:00:00Z", closedAt: "2024-01-02T01:00:00Z" }
    ];

    const metrics = calculator.calculate(trades);
    expect(metrics.profitFactor).toBe(3);
  });

  it("should calculate average win and loss correctly", () => {
    const trades: TradeMetrics[] = [
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-01T00:00:00Z", closedAt: "2024-01-01T01:00:00Z" },
      { pnl: 200, pnlPercentage: 2, openedAt: "2024-01-02T00:00:00Z", closedAt: "2024-01-02T01:00:00Z" },
      { pnl: -50, pnlPercentage: -0.5, openedAt: "2024-01-03T00:00:00Z", closedAt: "2024-01-03T01:00:00Z" },
      { pnl: -100, pnlPercentage: -1, openedAt: "2024-01-04T00:00:00Z", closedAt: "2024-01-04T01:00:00Z" }
    ];

    const metrics = calculator.calculate(trades);
    expect(metrics.averageWin).toBe(150);
    expect(metrics.averageLoss).toBe(-75);
    expect(metrics.averageWinPct).toBe(1.5);
    expect(metrics.averageLossPct).toBe(-0.75);
  });

  it("should calculate expectancy correctly", () => {
    const trades: TradeMetrics[] = [
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-01T00:00:00Z", closedAt: "2024-01-01T01:00:00Z" },
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-02T00:00:00Z", closedAt: "2024-01-02T01:00:00Z" },
      { pnl: -50, pnlPercentage: -0.5, openedAt: "2024-01-03T00:00:00Z", closedAt: "2024-01-03T01:00:00Z" }
    ];

    const metrics = calculator.calculate(trades);
    // Win rate: 66.67%, Avg win: 100, Avg loss: -50
    // Expectancy = 0.6667 * 100 + 0.3333 * (-50) = 66.67 - 16.67 = 50
    expect(metrics.expectancy).toBeCloseTo(50, 1);
  });

  it("should calculate max drawdown correctly", () => {
    const trades: TradeMetrics[] = [
      { pnl: 500, pnlPercentage: 5, openedAt: "2024-01-01T00:00:00Z", closedAt: "2024-01-01T01:00:00Z" },
      { pnl: -300, pnlPercentage: -3, openedAt: "2024-01-02T00:00:00Z", closedAt: "2024-01-02T01:00:00Z" },
      { pnl: -200, pnlPercentage: -2, openedAt: "2024-01-03T00:00:00Z", closedAt: "2024-01-03T01:00:00Z" },
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-04T00:00:00Z", closedAt: "2024-01-04T01:00:00Z" }
    ];

    const metrics = calculator.calculate(trades);
    // Equity: 10000 -> 10500 -> 10200 -> 10000 -> 10100
    // Peak: 10500, Valley: 10000, Drawdown: 500
    expect(metrics.maxDrawdown).toBe(500);
    expect(metrics.maxDrawdownPct).toBeCloseTo(4.76, 1);
  });

  it("should calculate streaks correctly", () => {
    const trades: TradeMetrics[] = [
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-01T00:00:00Z", closedAt: "2024-01-01T01:00:00Z" },
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-02T00:00:00Z", closedAt: "2024-01-02T01:00:00Z" },
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-03T00:00:00Z", closedAt: "2024-01-03T01:00:00Z" },
      { pnl: -50, pnlPercentage: -0.5, openedAt: "2024-01-04T00:00:00Z", closedAt: "2024-01-04T01:00:00Z" },
      { pnl: -50, pnlPercentage: -0.5, openedAt: "2024-01-05T00:00:00Z", closedAt: "2024-01-05T01:00:00Z" },
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-06T00:00:00Z", closedAt: "2024-01-06T01:00:00Z" }
    ];

    const metrics = calculator.calculate(trades);
    expect(metrics.longestWinStreak).toBe(3);
    expect(metrics.longestLossStreak).toBe(2);
    expect(metrics.currentStreak).toBe(1);
  });

  it("should calculate average holding time correctly", () => {
    const trades: TradeMetrics[] = [
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-01T00:00:00Z", closedAt: "2024-01-01T02:00:00Z" }, // 2 hours
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-02T00:00:00Z", closedAt: "2024-01-02T04:00:00Z" }  // 4 hours
    ];

    const metrics = calculator.calculate(trades);
    expect(metrics.averageHoldingTimeHours).toBe(3);
  });

  it("should calculate Sharpe ratio correctly", () => {
    const trades: TradeMetrics[] = [
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-01T00:00:00Z", closedAt: "2024-01-02T00:00:00Z" },
      { pnl: 150, pnlPercentage: 1.5, openedAt: "2024-01-03T00:00:00Z", closedAt: "2024-01-04T00:00:00Z" },
      { pnl: 200, pnlPercentage: 2, openedAt: "2024-01-05T00:00:00Z", closedAt: "2024-01-06T00:00:00Z" },
      { pnl: 120, pnlPercentage: 1.2, openedAt: "2024-01-07T00:00:00Z", closedAt: "2024-01-08T00:00:00Z" }
    ];

    const metrics = calculator.calculate(trades);
    expect(metrics.sharpeRatio).toBeGreaterThan(0);
  });

  it("should calculate Sortino ratio correctly", () => {
    const trades: TradeMetrics[] = [
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-01T00:00:00Z", closedAt: "2024-01-02T00:00:00Z" },
      { pnl: -50, pnlPercentage: -0.5, openedAt: "2024-01-03T00:00:00Z", closedAt: "2024-01-04T00:00:00Z" },
      { pnl: 200, pnlPercentage: 2, openedAt: "2024-01-05T00:00:00Z", closedAt: "2024-01-06T00:00:00Z" },
      { pnl: 150, pnlPercentage: 1.5, openedAt: "2024-01-07T00:00:00Z", closedAt: "2024-01-08T00:00:00Z" }
    ];

    const metrics = calculator.calculate(trades);
    expect(metrics.sortinoRatio).toBeGreaterThan(0);
    // Sortino should be higher than Sharpe since it only penalizes downside volatility
    expect(metrics.sortinoRatio).toBeGreaterThan(metrics.sharpeRatio);
  });

  it("should calculate Calmar ratio correctly", () => {
    const trades: TradeMetrics[] = [
      { pnl: 1000, pnlPercentage: 10, openedAt: "2024-01-01T00:00:00Z", closedAt: "2024-01-02T00:00:00Z" },
      { pnl: -200, pnlPercentage: -2, openedAt: "2024-01-03T00:00:00Z", closedAt: "2024-01-04T00:00:00Z" },
      { pnl: 500, pnlPercentage: 5, openedAt: "2024-01-05T00:00:00Z", closedAt: "2024-01-06T00:00:00Z" }
    ];

    const metrics = calculator.calculate(trades);
    expect(metrics.calmarRatio).toBeGreaterThan(0);
  });

  it("should handle all winning trades", () => {
    const trades: TradeMetrics[] = [
      { pnl: 100, pnlPercentage: 1, openedAt: "2024-01-01T00:00:00Z", closedAt: "2024-01-01T01:00:00Z" },
      { pnl: 200, pnlPercentage: 2, openedAt: "2024-01-02T00:00:00Z", closedAt: "2024-01-02T01:00:00Z" }
    ];

    const metrics = calculator.calculate(trades);
    expect(metrics.winRate).toBe(100);
    expect(metrics.losingTrades).toBe(0);
    expect(metrics.averageLoss).toBe(0);
  });

  it("should handle all losing trades", () => {
    const trades: TradeMetrics[] = [
      { pnl: -100, pnlPercentage: -1, openedAt: "2024-01-01T00:00:00Z", closedAt: "2024-01-01T01:00:00Z" },
      { pnl: -200, pnlPercentage: -2, openedAt: "2024-01-02T00:00:00Z", closedAt: "2024-01-02T01:00:00Z" }
    ];

    const metrics = calculator.calculate(trades);
    expect(metrics.winRate).toBe(0);
    expect(metrics.winningTrades).toBe(0);
    expect(metrics.averageWin).toBe(0);
    expect(metrics.profitFactor).toBe(0);
  });
});
