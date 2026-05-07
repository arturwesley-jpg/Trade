/**
 * Portfolio Backtester
 *
 * Backtests portfolio allocation strategies using historical data
 */

import type {
  AllocationStrategy,
  BacktestConfig,
  BacktestResult,
  RebalanceTrade,
} from './types.js';
import { PortfolioAnalyzer } from './portfolio-analyzer.js';
import { RebalancingEngine } from './rebalancing-engine.js';

export interface HistoricalPrice {
  symbol: string;
  date: Date;
  price: number;
}

export class PortfolioBacktester {
  private analyzer: PortfolioAnalyzer;
  private rebalancer: RebalancingEngine;

  constructor() {
    this.analyzer = new PortfolioAnalyzer();
    this.rebalancer = new RebalancingEngine();
  }

  /**
   * Backtest an allocation strategy
   */
  async backtest(
    strategy: AllocationStrategy,
    config: BacktestConfig,
    historicalPrices: HistoricalPrice[]
  ): Promise<BacktestResult> {
    const { startDate, endDate, initialCapital, rebalanceFrequency, transactionCostPct, slippagePct } = config;

    // Group prices by date
    const pricesByDate = this.groupPricesByDate(historicalPrices);
    const dates = Array.from(pricesByDate.keys()).sort((a, b) => a.getTime() - b.getTime());

    // Filter dates within backtest period
    const testDates = dates.filter(d => d >= startDate && d <= endDate);

    if (testDates.length === 0) {
      throw new Error('No historical data available for backtest period');
    }

    // Initialize portfolio
    let cash = initialCapital;
    const holdings: Map<string, number> = new Map(); // symbol -> quantity
    let lastRebalanceDate = testDates[0];
    let totalCost = 0;
    let totalTrades = 0;

    const periodReturns: { date: Date; value: number; return: number }[] = [];
    const rebalanceEvents: { date: Date; trades: RebalanceTrade[]; cost: number }[] = [];

    let previousValue = initialCapital;

    // Simulate each day
    for (const date of testDates) {
      const prices = pricesByDate.get(date)!;

      // Calculate current portfolio value
      let portfolioValue = cash;
      const positions = Array.from(holdings.entries()).map(([symbol, quantity]) => {
        const price = prices.find(p => p.symbol === symbol)?.price ?? 0;
        portfolioValue += quantity * price;
        return {
          symbol,
          quantity,
          averagePrice: 0, // not tracked in backtest
          currentPrice: price,
        };
      });

      // Check if rebalancing is needed
      const shouldRebalance = this.shouldRebalanceOnDate(
        date,
        lastRebalanceDate,
        rebalanceFrequency
      );

      if (shouldRebalance && portfolioValue > 0) {
        // Create snapshot
        const snapshot = this.analyzer.createSnapshot(positions, cash);
        const snapshotWithDrift = this.analyzer.calculateDrift(snapshot, strategy.assets);

        // Generate rebalancing trades
        const trades = this.analyzer.generateRebalanceTrades(
          snapshotWithDrift,
          strategy.assets,
          10 // min trade value
        );

        if (trades.length > 0) {
          // Execute trades
          const { newHoldings, newCash, cost } = this.executeTrades(
            trades,
            holdings,
            cash,
            prices,
            transactionCostPct,
            slippagePct
          );

          holdings.clear();
          newHoldings.forEach((quantity, symbol) => holdings.set(symbol, quantity));
          cash = newCash;
          totalCost += cost;
          totalTrades += trades.length;

          rebalanceEvents.push({
            date,
            trades,
            cost,
          });

          lastRebalanceDate = date;
        }
      }

      // Record period return
      const periodReturn = previousValue > 0 ? (portfolioValue - previousValue) / previousValue : 0;
      periodReturns.push({
        date,
        value: portfolioValue,
        return: periodReturn,
      });

      previousValue = portfolioValue;
    }

    // Calculate final metrics
    const finalValue = periodReturns[periodReturns.length - 1]?.value ?? initialCapital;
    const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;

    const returns = periodReturns.map(pr => pr.return);
    const metrics = this.analyzer.calculateMetrics(returns);

    // Annualize return
    const days = testDates.length;
    const years = days / 365;
    const annualizedReturn = years > 0 ? (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100 : 0;

    // Calculate win rate
    const winningTrades = rebalanceEvents.filter(event =>
      event.trades.some(t => t.drift > 0)
    ).length;
    const winRate = rebalanceEvents.length > 0 ? (winningTrades / rebalanceEvents.length) * 100 : 0;

    return {
      config,
      finalValue,
      totalReturn,
      annualizedReturn,
      volatility: metrics.volatility,
      sharpeRatio: metrics.sharpeRatio,
      maxDrawdown: metrics.maxDrawdown,
      winRate,
      totalTrades,
      totalCost,
      periodReturns,
      rebalanceEvents,
      timestamp: new Date(),
    };
  }

  /**
   * Compare multiple strategies
   */
  async compareStrategies(
    strategies: AllocationStrategy[],
    config: BacktestConfig,
    historicalPrices: HistoricalPrice[]
  ): Promise<Map<string, BacktestResult>> {
    const results = new Map<string, BacktestResult>();

    for (const strategy of strategies) {
      const result = await this.backtest(strategy, config, historicalPrices);
      results.set(strategy.id, result);
    }

    return results;
  }

  /**
   * Group prices by date
   */
  private groupPricesByDate(prices: HistoricalPrice[]): Map<Date, HistoricalPrice[]> {
    const grouped = new Map<Date, HistoricalPrice[]>();

    prices.forEach(price => {
      const dateKey = new Date(price.date.toDateString()); // normalize to day
      const existing = grouped.get(dateKey) ?? [];
      existing.push(price);
      grouped.set(dateKey, existing);
    });

    return grouped;
  }

  /**
   * Check if rebalancing should occur on this date
   */
  private shouldRebalanceOnDate(
    currentDate: Date,
    lastRebalanceDate: Date,
    frequency: 'daily' | 'weekly' | 'monthly'
  ): boolean {
    const daysSince = Math.floor(
      (currentDate.getTime() - lastRebalanceDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    switch (frequency) {
      case 'daily':
        return daysSince >= 1;
      case 'weekly':
        return daysSince >= 7;
      case 'monthly':
        return daysSince >= 30;
      default:
        return false;
    }
  }

  /**
   * Execute trades and update holdings
   */
  private executeTrades(
    trades: RebalanceTrade[],
    currentHoldings: Map<string, number>,
    currentCash: number,
    prices: HistoricalPrice[],
    transactionCostPct: number,
    slippagePct: number
  ): { newHoldings: Map<string, number>; newCash: number; cost: number } {
    const newHoldings = new Map(currentHoldings);
    let newCash = currentCash;
    let totalCost = 0;

    for (const trade of trades) {
      const price = prices.find(p => p.symbol === trade.symbol)?.price;
      if (!price) continue;

      // Apply slippage
      const executionPrice = trade.action === 'BUY'
        ? price * (1 + slippagePct / 100)
        : price * (1 - slippagePct / 100);

      const tradeValue = trade.quantity * executionPrice;
      const transactionCost = tradeValue * (transactionCostPct / 100);

      if (trade.action === 'BUY') {
        const totalCost = tradeValue + transactionCost;
        if (newCash >= totalCost) {
          newCash -= totalCost;
          const currentQty = newHoldings.get(trade.symbol) ?? 0;
          newHoldings.set(trade.symbol, currentQty + trade.quantity);
          totalCost += transactionCost;
        }
      } else {
        // SELL
        const currentQty = newHoldings.get(trade.symbol) ?? 0;
        const sellQty = Math.min(trade.quantity, currentQty);
        if (sellQty > 0) {
          const proceeds = sellQty * executionPrice - transactionCost;
          newCash += proceeds;
          newHoldings.set(trade.symbol, currentQty - sellQty);
          totalCost += transactionCost;
        }
      }
    }

    return { newHoldings, newCash, cost: totalCost };
  }
}
