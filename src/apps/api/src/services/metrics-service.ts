/**
 * Metrics Service
 *
 * Aggregates and provides comprehensive trading metrics including:
 * - Performance metrics (returns, risk-adjusted metrics)
 * - Risk metrics (VaR, volatility, exposure)
 * - Advanced metrics with time period filters
 * - Equity curve data for visualization
 * - Trade analysis and statistics
 */

import type { TradingRepository } from "@trade/trading-core";
import { MetricsCalculator } from "@trade/trading-core/metrics/metrics-calculator.js";
import {
  RiskAnalyzer,
  TimeSeriesAnalyzer,
  type PerformanceMetrics,
  type RiskMetrics,
  type TradeMetrics
} from "@trade/trading-core";
import type { Trade, Position } from "@trade/shared";
import { logger } from "@trade/shared/logger";

export type MetricsPeriod = "1d" | "7d" | "30d" | "90d" | "1y" | "all";

export interface AdvancedMetrics {
  performance: PerformanceMetrics;
  risk: RiskMetrics;
  period: MetricsPeriod;
}

/**
 * Equity curve data point
 */
export interface EquityCurvePoint {
  timestamp: string;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

/**
 * Trade analysis response
 */
export interface TradeAnalysis {
  recentTrades: Array<{
    id: string;
    symbol: string;
    side: string;
    pnl: number;
    pnlPct: number;
    openedAt: string;
    closedAt: string;
    holdingTimeHours: number;
  }>;
  totalTrades: number;
}

/**
 * Configuration for metrics service
 */
export interface MetricsServiceConfig {
  repository: TradingRepository;
  initialCapital?: number;
  riskFreeRate?: number;
  userId?: string;
}

/**
 * Service for calculating and aggregating trading metrics
 */
export class MetricsService {
  private readonly repository: TradingRepository;
  private readonly metricsCalculator: MetricsCalculator;
  private readonly riskAnalyzer: RiskAnalyzer;
  private readonly timeSeriesAnalyzer: TimeSeriesAnalyzer;
  private readonly initialCapital: number;
  private readonly userId?: string;

  constructor(config: MetricsServiceConfig) {
    this.repository = config.repository;
    this.initialCapital = config.initialCapital ?? 10_000;
    this.userId = config.userId;

    const metricsConfig = {
      initialCapital: this.initialCapital,
      riskFreeRate: config.riskFreeRate ?? 0.02
    };

    this.metricsCalculator = new MetricsCalculator(metricsConfig);
    this.riskAnalyzer = new RiskAnalyzer(metricsConfig);
    this.timeSeriesAnalyzer = new TimeSeriesAnalyzer();

    logger.debug("MetricsService initialized", {
      userId: this.userId,
      initialCapital: this.initialCapital
    });
  }

  /**
   * Get performance metrics for all closed trades
   */
  async getPerformance(userId?: string): Promise<PerformanceMetrics> {
    const startTime = Date.now();

    try {
      const trades = await this.getClosedTrades(userId);
      const tradeMetrics = this.extractTradeMetrics(trades);

      const metrics = this.metricsCalculator.calculate(tradeMetrics);

      logger.info("Performance metrics calculated", {
        userId: userId ?? this.userId,
        totalTrades: tradeMetrics.length,
        duration: Date.now() - startTime
      });

      return metrics;
    } catch (error) {
      logger.error("Failed to calculate performance metrics", {
        userId: userId ?? this.userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get risk metrics for all closed trades
   */
  async getRisk(userId?: string): Promise<RiskMetrics> {
    const startTime = Date.now();

    try {
      const trades = await this.getClosedTrades(userId);
      const tradeMetrics = this.extractTradeMetrics(trades);
      const openPositions = await this.getOpenPositions(userId);

      const metrics = this.riskAnalyzer.analyze(
        tradeMetrics,
        undefined, // No benchmark returns for now
        openPositions.map(p => ({ marginUsdt: p.marginUsdt }))
      );

      logger.info("Risk metrics calculated", {
        userId: userId ?? this.userId,
        totalTrades: tradeMetrics.length,
        openPositions: openPositions.length,
        duration: Date.now() - startTime
      });

      return metrics;
    } catch (error) {
      logger.error("Failed to calculate risk metrics", {
        userId: userId ?? this.userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get advanced metrics with time period filter
   */
  async getAdvanced(period: MetricsPeriod = "all", userId?: string): Promise<AdvancedMetrics> {
    const startTime = Date.now();

    try {
      const trades = await this.getClosedTrades(userId);
      const tradeMetrics = this.extractTradeMetrics(trades);

      const performance = this.metricsCalculator.calculate(tradeMetrics);
      const risk = this.riskAnalyzer.analyze(tradeMetrics);

      const metrics: AdvancedMetrics = {
        performance,
        risk,
        period
      };

      logger.info("Advanced metrics calculated", {
        userId: userId ?? this.userId,
        period,
        totalTrades: trades.length,
        duration: Date.now() - startTime
      });

      return metrics;
    } catch (error) {
      logger.error("Failed to calculate advanced metrics", {
        userId: userId ?? this.userId,
        period,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get equity curve data for visualization
   */
  async getEquityCurve(userId?: string): Promise<EquityCurvePoint[]> {
    const startTime = Date.now();

    try {
      const trades = await this.getClosedTrades(userId);

      if (trades.length === 0) {
        return [];
      }

      // Sort trades by closed date
      const sortedTrades = trades
        .filter(t => t.closedAt)
        .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());

      let equity = this.initialCapital;
      let peak = equity;
      const curve: EquityCurvePoint[] = [];

      // Add initial point
      curve.push({
        timestamp: sortedTrades[0].openedAt,
        equity: this.initialCapital,
        drawdown: 0,
        drawdownPct: 0
      });

      // Calculate equity curve
      for (const trade of sortedTrades) {
        equity += trade.pnlUsdt ?? 0;

        if (equity > peak) {
          peak = equity;
        }

        const drawdown = peak - equity;
        const drawdownPct = (drawdown / peak) * 100;

        curve.push({
          timestamp: trade.closedAt!,
          equity: this.round(equity, 2),
          drawdown: this.round(drawdown, 2),
          drawdownPct: this.round(drawdownPct, 2)
        });
      }

      logger.info("Equity curve calculated", {
        userId: userId ?? this.userId,
        points: curve.length,
        duration: Date.now() - startTime
      });

      return curve;
    } catch (error) {
      logger.error("Failed to calculate equity curve", {
        userId: userId ?? this.userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get trade analysis with recent trades
   */
  async getTradesAnalysis(limit: number = 20, userId?: string): Promise<TradeAnalysis> {
    const startTime = Date.now();

    try {
      const trades = await this.getClosedTrades(userId);

      // Sort by closed date descending
      const sortedTrades = trades
        .filter(t => t.closedAt)
        .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime())
        .slice(0, limit);

      const recentTrades = sortedTrades.map(trade => {
        const openedAt = new Date(trade.openedAt);
        const closedAt = new Date(trade.closedAt!);
        const holdingTimeHours = (closedAt.getTime() - openedAt.getTime()) / (1000 * 60 * 60);
        const pnlPct = ((trade.pnlUsdt ?? 0) / trade.marginUsdt) * 100;

        return {
          id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          pnl: this.round(trade.pnlUsdt ?? 0, 2),
          pnlPct: this.round(pnlPct, 2),
          openedAt: trade.openedAt,
          closedAt: trade.closedAt!,
          holdingTimeHours: this.round(holdingTimeHours, 2)
        };
      });

      logger.info("Trade analysis calculated", {
        userId: userId ?? this.userId,
        totalTrades: trades.length,
        recentTrades: recentTrades.length,
        duration: Date.now() - startTime
      });

      return {
        recentTrades,
        totalTrades: trades.length
      };
    } catch (error) {
      logger.error("Failed to calculate trade analysis", {
        userId: userId ?? this.userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get all closed trades from repository
   */
  private async getClosedTrades(userId?: string): Promise<Trade[]> {
    const snapshot = this.repository.snapshot();

    // Filter by userId if provided (for multi-user support)
    let trades = snapshot.trades.filter((t: Trade) => t.status === "CLOSED");

    if (userId) {
      // Note: Trade type doesn't have userId yet, but we're preparing for it
      trades = trades.filter((t: Trade) => (t as any).userId === userId);
    }

    return trades;
  }

  /**
   * Get all open positions from repository
   */
  private async getOpenPositions(userId?: string): Promise<Position[]> {
    const snapshot = this.repository.snapshot();

    let positions = snapshot.positions.filter(p => p.status === "OPEN");

    if (userId) {
      // Note: Position type doesn't have userId yet, but we're preparing for it
      positions = positions.filter(p => (p as any).userId === userId);
    }

    return positions;
  }

  /**
   * Extract trade metrics from trades
   */
  private extractTradeMetrics(trades: Trade[]): TradeMetrics[] {
    return trades
      .filter(t => t.status === "CLOSED" && t.closedAt && t.pnlUsdt !== undefined)
      .map(t => ({
        pnl: t.pnlUsdt!,
        pnlPercentage: ((t.pnlUsdt! / t.marginUsdt) * 100),
        openedAt: t.openedAt,
        closedAt: t.closedAt!
      }));
  }

  /**
   * Round number to specified decimal places
   */
  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
