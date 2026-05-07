import type { BacktestResult, Candle, TimeInterval } from "@trade/trading-core";
import type { Backtest, BacktestMetricsRecord, BacktestTrade, CreateBacktestRequest, BacktestWithMetrics, BacktestListResponse } from "@trade/shared";
import { BacktestRepository, type CreateBacktestData } from "./backtest-repository.js";
import { HistoricalDataFetcher, BacktestEngine } from "@trade/trading-core";

// Simple signal generator that implements the required interface
class SimpleSignalGenerator {
  generateSignal(
    candles: Candle[],
    currentPrice: number
  ): {
    signal: "LONG" | "SHORT" | "WAIT";
    confidence: number;
    shouldExecute: boolean;
    entryPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    reasoning: string;
  } | null {
    if (candles.length < 50) return null;

    // Simple moving average crossover strategy
    const sma20 = candles.slice(-20).reduce((sum, c) => sum + c.close, 0) / 20;
    const sma50 = candles.slice(-50).reduce((sum, c) => sum + c.close, 0) / 50;

    const atr = this.calculateATR(candles.slice(-14));
    const stopLossDistance = atr * 2;
    const takeProfitDistance = atr * 3;

    if (sma20 > sma50 && currentPrice > sma20) {
      return {
        signal: "LONG",
        confidence: 0.7,
        shouldExecute: true,
        entryPrice: currentPrice,
        stopLoss: currentPrice - stopLossDistance,
        takeProfit: currentPrice + takeProfitDistance,
        reasoning: "SMA20 above SMA50 with price confirmation"
      };
    } else if (sma20 < sma50 && currentPrice < sma20) {
      return {
        signal: "SHORT",
        confidence: 0.7,
        shouldExecute: true,
        entryPrice: currentPrice,
        stopLoss: currentPrice + stopLossDistance,
        takeProfit: currentPrice - takeProfitDistance,
        reasoning: "SMA20 below SMA50 with price confirmation"
      };
    }

    return null;
  }

  private calculateATR(candles: Candle[]): number {
    if (candles.length === 0) return 0;

    let sum = 0;
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      sum += tr;
    }

    return sum / (candles.length - 1);
  }
}

export interface BacktestServiceConfig {
  backtestRepository: BacktestRepository;
  historicalDataFetcher: HistoricalDataFetcher;
}

export class BacktestService {
  private backtestRepository: BacktestRepository;
  private historicalDataFetcher: HistoricalDataFetcher;

  constructor(config: BacktestServiceConfig) {
    this.backtestRepository = config.backtestRepository;
    this.historicalDataFetcher = config.historicalDataFetcher;
  }

  async runBacktest(
    backtestId: string,
    config: {
      symbol: string;
      startDate: string;
      endDate: string;
      interval: string;
      initialCapital: number;
      feeRate: number;
      slippageRate: number;
      maxLeverage?: number;
      riskPerTrade?: number;
      stopLossAtr?: number;
      takeProfitAtr?: number;
    }
  ): Promise<BacktestResult> {
    try {
      // Update status to running
      await this.backtestRepository.updateBacktestStatus({
        backtestId,
        status: "running",
        startedAt: new Date()
      });

      // Fetch historical data
      const candles = await this.historicalDataFetcher.fetchHistoricalCandles({
        symbol: config.symbol,
        interval: config.interval as TimeInterval,
        startDate: new Date(config.startDate),
        endDate: new Date(config.endDate)
      });

      if (candles.length === 0) {
        throw new Error("No historical data available for the specified period");
      }

      // Create backtest engine
      const engine = new BacktestEngine({
        symbol: config.symbol,
        startDate: new Date(config.startDate),
        endDate: new Date(config.endDate),
        initialCapital: config.initialCapital,
        feeRate: config.feeRate,
        slippageRate: config.slippageRate,
        maxLeverage: config.maxLeverage ?? 4,
        riskPerTrade: config.riskPerTrade ?? 2,
        stopLossAtr: config.stopLossAtr ?? 2,
        takeProfitAtr: config.takeProfitAtr ?? 3
      });

      // Create signal generator
      const signalGenerator = new SimpleSignalGenerator();

      // Run backtest
      const result = await engine.run(candles, signalGenerator);

      // Save metrics
      const metricsRecord = this.convertMetricsToRecord(result);
      await this.backtestRepository.saveBacktestMetrics(backtestId, metricsRecord);

      // Save trades
      const trades = this.convertTradesToRecords(result.trades);
      await this.backtestRepository.saveBacktestTrades(backtestId, trades);

      // Update status to completed
      await this.backtestRepository.updateBacktestStatus({
        backtestId,
        status: "completed",
        completedAt: new Date()
      });

      return result;
    } catch (error) {
      // Update status to failed
      await this.backtestRepository.updateBacktestStatus({
        backtestId,
        status: "failed",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error"
      });

      throw error;
    }
  }

  private convertMetricsToRecord(metrics: BacktestResult): Omit<BacktestMetricsRecord, "backtestId" | "createdAt"> {
    return {
      totalReturn: metrics.totalReturn,
      totalReturnPct: metrics.totalReturnPct,
      sharpeRatio: metrics.sharpeRatio,
      sortinoRatio: undefined,
      calmarRatio: undefined,
      maxDrawdown: metrics.maxDrawdown,
      maxDrawdownPct: metrics.maxDrawdownPct,
      winRate: metrics.winRate,
      profitFactor: metrics.profitFactor,
      totalTrades: metrics.totalTrades,
      winningTrades: metrics.winningTrades,
      losingTrades: metrics.losingTrades,
      averageWin: undefined,
      averageLoss: undefined,
      largestWin: undefined,
      largestLoss: undefined,
      averageTradeDurationHours: undefined,
      expectancy: undefined,
      var95: undefined,
      cvar95: undefined,
      ulcerIndex: undefined,
      recoveryFactor: undefined,
      payoffRatio: undefined,
      riskRewardRatio: undefined,
      kellyCriterion: undefined
    };
  }

  private convertTradesToRecords(trades: BacktestResult["trades"]): Omit<BacktestTrade, "id" | "backtestId">[] {
    return trades.map((trade: BacktestResult["trades"][number]) => ({
      symbol: "",
      side: trade.side,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      quantity: trade.size,
      pnl: trade.pnl,
      pnlPct: trade.pnlPercent,
      openedAt: new Date(trade.entryTime).toISOString(),
      closedAt: new Date(trade.exitTime).toISOString(),
      durationHours: (trade.exitTime - trade.entryTime) / 3_600_000,
      entryReason: undefined,
      exitReason: trade.exitReason
    }));
  }

  async createBacktest(data: CreateBacktestData): Promise<Backtest> {
    return this.backtestRepository.createBacktest(data);
  }

  async getBacktestById(id: string): Promise<BacktestWithMetrics | null> {
    return this.backtestRepository.findBacktestById(id);
  }

  async getBacktestsByUserId(
    userId: string,
    options: { page?: number; pageSize?: number; status?: string } = {}
  ): Promise<{ backtests: BacktestWithMetrics[]; total: number }> {
    return this.backtestRepository.findBacktestsByUserId(userId, options);
  }

  async getBacktestTrades(backtestId: string): Promise<BacktestTrade[]> {
    return this.backtestRepository.getBacktestTrades(backtestId);
  }
}
