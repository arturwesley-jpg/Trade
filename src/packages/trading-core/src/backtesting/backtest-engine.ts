/**
 * Backtesting Engine
 * Simulates trading strategies on historical data
 */

import type { Candle } from "./historical-data-fetcher.js";
import type { TradingStrategy, StrategyContext, TradingSignal } from "./strategy-interface.js";

export interface BacktestConfig {
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  feeRate: number;
  slippageRate: number;
  maxLeverage: number;
  riskPerTrade: number;
  stopLossAtr: number;
  takeProfitAtr: number;
  commission?: number; // percentage, e.g., 0.001 = 0.1%
  slippage?: number; // percentage
  maxPositionSize?: number; // percentage of capital
}

export interface BacktestPosition {
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  entryTime: number;
  size: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface BacktestTrade {
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  size: number;
  pnl: number;
  pnlPercent: number;
  fees: number;
  commission?: number;
  exitReason: "SIGNAL" | "STOP_LOSS" | "TAKE_PROFIT" | "END_OF_DATA";
  reason?: "signal" | "stop_loss" | "take_profit" | "end_of_data";
}

export interface BacktestSignal {
  timestamp: number;
  action: "buy" | "sell" | "close";
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  size?: number;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  equity: number[];
  timestamps: number[];
  equityCurve: { timestamp: number; equity: number }[];
  finalCapital: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalReturnPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  avgTradeDuration: number; // in milliseconds
  totalFees: number;
}

export interface BacktestMetrics {
  totalReturn: number;
  totalReturnPct: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  totalTrades: number;
}

export type StrategyFunction = (candles: Candle[], index: number) => BacktestSignal | null;

export interface StrategySignalGenerator {
  generateSignal: (candles: Candle[], currentPrice: number) => {
    signal: "LONG" | "SHORT" | "WAIT";
    confidence: number;
    shouldExecute: boolean;
    entryPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    reasoning: string;
  } | null;
}

// Type guard to check if a strategy is a StrategySignalGenerator
function isStrategySignalGenerator(strategy: StrategyFunction | StrategySignalGenerator): strategy is StrategySignalGenerator {
  return 'generateSignal' in strategy && typeof strategy.generateSignal === 'function';
}

export class BacktestEngine {
  private capital: number;
  private position: BacktestPosition | null = null;
  private trades: BacktestTrade[] = [];
  private equity: number[] = [];
  private timestamps: number[] = [];

  constructor(private readonly config: BacktestConfig) {
    this.capital = config.initialCapital;
  }

  async run(candles: Candle[], strategy: StrategySignalGenerator | StrategyFunction | TradingStrategy): Promise<BacktestResult> {
    this.reset();

    // Initialize strategy if it has an initialize method
    if ('initialize' in strategy && typeof strategy.initialize === 'function') {
      await strategy.initialize(candles);
    }

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];

      // Record equity
      const currentEquity = this.calculateEquity(candle.close);
      this.equity.push(currentEquity);
      this.timestamps.push(candle.timestamp);

      // Check stop loss / take profit
      if (this.position) {
        const exitReason = this.checkExitConditions(candle);
        if (exitReason) {
          this.closePosition(candle.close, candle.timestamp, exitReason);
        }
      }

      // Get strategy signal
      if (this.isTradingStrategy(strategy)) {
        const context: StrategyContext = {
          candles: candles.slice(0, i + 1),
          currentIndex: i,
          currentPrice: candle.close,
          capital: this.capital,
          position: this.position ? {
            side: this.position.side,
            entryPrice: this.position.entryPrice,
            size: this.position.size
          } : null,
          indicators: {}
        };

        const signal = strategy.generateSignal(context);
        if (signal) {
          this.processTradingSignal(signal, candle, strategy, context);
        }
      } else if (isStrategySignalGenerator(strategy)) {
        const signal = strategy.generateSignal(candles.slice(0, i + 1), candle.close);
        if (signal && signal.shouldExecute) {
          this.processStrategySignal(signal, candle);
        }
      } else {
        const signal = strategy(candles, i);
        if (signal) {
          this.processSignal(signal, candle);
        }
      }
    }

    // Close any remaining position
    if (this.position && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      this.closePosition(lastCandle.close, lastCandle.timestamp, "END_OF_DATA");
    }

    return this.calculateResults();
  }

  private isTradingStrategy(strategy: any): strategy is TradingStrategy {
    return 'generateSignal' in strategy && 'name' in strategy && 'description' in strategy;
  }

  private reset(): void {
    this.capital = this.config.initialCapital;
    this.position = null;
    this.trades = [];
    this.equity = [];
    this.timestamps = [];
  }

  private processSignal(signal: BacktestSignal, candle: Candle): void {
    if (signal.action === "close" && this.position) {
      this.closePosition(signal.price, signal.timestamp, "SIGNAL");
    } else if (signal.action === "buy" && !this.position) {
      this.openPosition("long", signal.price, signal.timestamp, signal.stopLoss, signal.takeProfit, signal.size);
    } else if (signal.action === "sell" && !this.position) {
      this.openPosition("short", signal.price, signal.timestamp, signal.stopLoss, signal.takeProfit, signal.size);
    }
  }

  private processTradingSignal(
    signal: TradingSignal,
    candle: Candle,
    strategy: TradingStrategy,
    context: StrategyContext
  ): void {
    if (signal.action === "HOLD") {
      return;
    }

    // Close position
    if (signal.action === "CLOSE" && this.position) {
      this.closePosition(candle.close, candle.timestamp, "SIGNAL");
      return;
    }

    // Sell/Short signal
    if (signal.action === "SELL") {
      if (this.position) {
        this.closePosition(candle.close, candle.timestamp, "SIGNAL");
      }
      return;
    }

    // Buy signal
    if (signal.action === "BUY") {
      // Close existing position if opposite direction
      if (this.position) {
        this.closePosition(candle.close, candle.timestamp, "SIGNAL");
      }

      // Calculate position size
      const positionSizePercent = strategy.calculatePositionSize?.(context, signal) ?? 0.95;
      const positionValue = this.capital * positionSizePercent;

      const entryPrice = signal.price ?? candle.close;
      const slippage = entryPrice * this.config.slippageRate;
      const actualEntryPrice = entryPrice + slippage;

      const size = positionValue / actualEntryPrice;

      // Calculate stop loss and take profit
      const stopLoss = signal.stopLoss ?? strategy.calculateStopLoss?.(context, signal);
      const takeProfit = signal.takeProfit ?? strategy.calculateTakeProfit?.(context, signal);

      this.position = {
        symbol: this.config.symbol ?? "BTC-USDT",
        side: "long",
        entryPrice: actualEntryPrice,
        entryTime: candle.timestamp,
        size,
        stopLoss,
        takeProfit
      };

      // Notify strategy
      if (strategy.onTradeExecuted) {
        strategy.onTradeExecuted({
          side: "BUY",
          price: actualEntryPrice,
          size,
          timestamp: candle.timestamp
        });
      }
    }
  }

  private processStrategySignal(
    signal: NonNullable<ReturnType<StrategySignalGenerator['generateSignal']>>,
    candle: Candle
  ): void {
    if (signal.signal === "WAIT") {
      return;
    }

    // Close existing position if signal is opposite
    if (this.position) {
      if (
        (this.position.side === "long" && signal.signal === "SHORT") ||
        (this.position.side === "short" && signal.signal === "LONG")
      ) {
        this.closePosition(candle.close, candle.timestamp, "SIGNAL");
      } else {
        return; // Already in position with same direction
      }
    }

    // Open new position
    const side = signal.signal === "LONG" ? "long" : "short";
    const entryPrice = signal.entryPrice || candle.close;
    const slippage = entryPrice * this.config.slippageRate;
    const actualEntryPrice = side === "long" ? entryPrice + slippage : entryPrice - slippage;

    const positionSize = this.capital * (this.config.maxPositionSize || 0.95);
    const size = positionSize / actualEntryPrice;

    this.position = {
      symbol: this.config.symbol ?? "BTC-USDT",
      side,
      entryPrice: actualEntryPrice,
      entryTime: candle.timestamp,
      size,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit
    };
  }

  private openPosition(
    side: "long" | "short",
    price: number,
    timestamp: number,
    stopLoss?: number,
    takeProfit?: number,
    sizePercent?: number
  ): void {
    const positionSize = Math.min(
      sizePercent ?? this.config.maxPositionSize ?? 1.0,
      this.config.maxPositionSize ?? 1.0
    );
    const size = (this.capital * positionSize) / price;
    const slippage = this.config.slippage ?? 0;
    const priceWithSlippage = price * (1 + (side === "long" ? slippage : -slippage));

    this.position = {
      symbol: "BTC-USDT",
      side,
      entryPrice: priceWithSlippage,
      entryTime: timestamp,
      size,
      stopLoss,
      takeProfit
    };
  }

  private closePosition(price: number, timestamp: number, reason: "SIGNAL" | "STOP_LOSS" | "TAKE_PROFIT" | "END_OF_DATA"): void {
    if (!this.position) return;

    const slippage = price * this.config.slippageRate;
    const priceWithSlippage = this.position.side === "long" ? price - slippage : price + slippage;

    const pnl = this.position.side === "long"
      ? (priceWithSlippage - this.position.entryPrice) * this.position.size
      : (this.position.entryPrice - priceWithSlippage) * this.position.size;

    const fees = (this.position.entryPrice * this.position.size * this.config.feeRate) +
                 (priceWithSlippage * this.position.size * this.config.feeRate);

    const netPnl = pnl - fees;
    const pnlPercent = (netPnl / (this.position.entryPrice * this.position.size)) * 100;

    this.trades.push({
      symbol: this.position.symbol,
      side: this.position.side === "long" ? "LONG" : "SHORT",
      entryPrice: this.position.entryPrice,
      exitPrice: priceWithSlippage,
      entryTime: this.position.entryTime,
      exitTime: timestamp,
      size: this.position.size,
      pnl: netPnl,
      pnlPercent,
      fees,
      exitReason: reason
    });

    this.capital += netPnl;
    this.position = null;
  }

  private checkExitConditions(candle: Candle): "STOP_LOSS" | "TAKE_PROFIT" | null {
    if (!this.position) return null;

    if (this.position.side === "long") {
      if (this.position.stopLoss && candle.low <= this.position.stopLoss) {
        return "STOP_LOSS";
      }
      if (this.position.takeProfit && candle.high >= this.position.takeProfit) {
        return "TAKE_PROFIT";
      }
    } else {
      if (this.position.stopLoss && candle.high >= this.position.stopLoss) {
        return "STOP_LOSS";
      }
      if (this.position.takeProfit && candle.low <= this.position.takeProfit) {
        return "TAKE_PROFIT";
      }
    }

    return null;
  }

  private calculateEquity(currentPrice: number): number {
    if (!this.position) return this.capital;

    const unrealizedPnl = this.position.side === "long"
      ? (currentPrice - this.position.entryPrice) * this.position.size
      : (this.position.entryPrice - currentPrice) * this.position.size;

    return this.capital + unrealizedPnl;
  }

  private calculateResults(): BacktestResult {
    const totalReturn = this.capital - this.config.initialCapital;
    const totalReturnPercent = (totalReturn / this.config.initialCapital) * 100;

    const winningTrades = this.trades.filter(t => t.pnl > 0);
    const losingTrades = this.trades.filter(t => t.pnl <= 0);
    const winRate = this.trades.length > 0 ? (winningTrades.length / this.trades.length) * 100 : 0;

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

    const avgWin = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;

    const totalFees = this.trades.reduce((sum, t) => sum + t.fees, 0);

    // Calculate average trade duration
    const avgTradeDuration = this.trades.length > 0
      ? this.trades.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0) / this.trades.length
      : 0;

    const { maxDrawdown, maxDrawdownPercent } = this.calculateMaxDrawdown();
    const sharpeRatio = this.calculateSharpeRatio();
    const sortinoRatio = this.calculateSortinoRatio();
    const calmarRatio = this.calculateCalmarRatio(totalReturnPercent, maxDrawdownPercent);

    // Build equity curve
    const equityCurve = this.timestamps.map((timestamp, i) => ({
      timestamp,
      equity: this.equity[i]
    }));

    return {
      trades: this.trades,
      equity: this.equity,
      timestamps: this.timestamps,
      equityCurve,
      finalCapital: this.capital,
      totalReturn,
      totalReturnPercent,
      totalReturnPct: totalReturnPercent,
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
      maxDrawdown,
      maxDrawdownPercent,
      maxDrawdownPct: maxDrawdownPercent,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      avgTradeDuration,
      totalFees
    };
  }

  private calculateCalmarRatio(annualReturn: number, maxDrawdown: number): number {
    if (maxDrawdown === 0) return annualReturn > 0 ? Infinity : 0;
    return annualReturn / maxDrawdown;
  }

  private calculateMaxDrawdown(): { maxDrawdown: number; maxDrawdownPercent: number } {
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let peak = this.config.initialCapital;

    for (const equity of this.equity) {
      if (equity > peak) {
        peak = equity;
      }
      const drawdown = peak - equity;
      const drawdownPercent = (drawdown / peak) * 100;
      
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }

    return { maxDrawdown, maxDrawdownPercent };
  }

  private calculateSharpeRatio(): number {
    if (this.equity.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < this.equity.length; i++) {
      returns.push((this.equity[i] - this.equity[i - 1]) / this.equity[i - 1]);
    }

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    return stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
  }

  private calculateSortinoRatio(): number {
    if (this.equity.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < this.equity.length; i++) {
      returns.push((this.equity[i] - this.equity[i - 1]) / this.equity[i - 1]);
    }

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downside = returns.filter(r => r < 0);
    
    if (downside.length === 0) return avgReturn > 0 ? Infinity : 0;

    const downsideVariance = downside.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downside.length;
    const downsideStdDev = Math.sqrt(downsideVariance);

    return downsideStdDev > 0 ? (avgReturn / downsideStdDev) * Math.sqrt(252) : 0;
  }
}
