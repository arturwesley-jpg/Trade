/**
 * Backtesting Example
 * Demonstrates how to use the backtesting system
 */

import {
  BinanceHistoricalDataSource,
  HistoricalDataFetcher
} from "../packages/trading-core/src/backtesting/historical-data-fetcher.js";
import { BacktestEngine } from "../packages/trading-core/src/backtesting/backtest-engine.js";
import {
  StrategyRunner,
  createSMACrossoverStrategy,
  createRSIStrategy
} from "../packages/trading-core/src/backtesting/strategy-runner.js";

async function main() {
  console.log("🔄 Fetching historical data...");

  // Fetch historical data
  const fetcher = new HistoricalDataFetcher([
    new BinanceHistoricalDataSource()
  ]);

  const endTime = Date.now();
  const startTime = endTime - 90 * 24 * 60 * 60 * 1000; // 90 days ago

  const candles = await fetcher.fetchCandlesInBatches({
    symbol: "BTC-USDT",
    interval: "1h",
    startTime,
    endTime
  });

  console.log(`✅ Fetched ${candles.length} candles`);

  // Backtest configuration
  const config = {
    initialCapital: 10000,
    commission: 0.001, // 0.1%
    slippage: 0.0005, // 0.05%
    maxPositionSize: 0.95 // 95% of capital
  };

  // Example 1: Simple backtest with SMA crossover
  console.log("\n📊 Running SMA Crossover backtest...");
  const runner = new StrategyRunner(config);
  const smaStrategy = createSMACrossoverStrategy({ fastPeriod: 20, slowPeriod: 50 });
  const smaResult = await runner.runBacktest(candles, smaStrategy);

  console.log("\n=== SMA Crossover Results ===");
  console.log(`Final Capital: $${smaResult.finalCapital.toFixed(2)}`);
  console.log(`Total Return: ${smaResult.totalReturnPercent.toFixed(2)}%`);
  console.log(`Total Trades: ${smaResult.totalTrades}`);
  console.log(`Win Rate: ${smaResult.winRate.toFixed(2)}%`);
  console.log(`Profit Factor: ${smaResult.profitFactor.toFixed(2)}`);
  console.log(`Max Drawdown: ${smaResult.maxDrawdownPercent.toFixed(2)}%`);
  console.log(`Sharpe Ratio: ${smaResult.sharpeRatio.toFixed(2)}`);
  console.log(`Sortino Ratio: ${smaResult.sortinoRatio.toFixed(2)}`);

  // Example 2: Parameter optimization
  console.log("\n🔧 Optimizing RSI strategy parameters...");
  const optimizationResults = await runner.optimizeParameters(
    candles,
    (params) => createRSIStrategy({
      period: params.period,
      oversold: params.oversold,
      overbought: params.overbought
    }),
    [
      { name: "period", min: 10, max: 20, step: 5 },
      { name: "oversold", min: 20, max: 35, step: 5 },
      { name: "overbought", min: 65, max: 80, step: 5 }
    ],
    "sharpeRatio"
  );

  console.log("\n=== Top 3 Parameter Combinations ===");
  for (let i = 0; i < Math.min(3, optimizationResults.length); i++) {
    const opt = optimizationResults[i];
    console.log(`\n#${i + 1} - Score: ${opt.score.toFixed(2)}`);
    console.log(`Parameters:`, opt.parameters);
    console.log(`Return: ${opt.result.totalReturnPercent.toFixed(2)}%`);
    console.log(`Win Rate: ${opt.result.winRate.toFixed(2)}%`);
    console.log(`Sharpe: ${opt.result.sharpeRatio.toFixed(2)}`);
  }

  // Example 3: Walk-forward analysis
  console.log("\n🚶 Running walk-forward analysis...");
  const walkForwardResult = await runner.walkForwardAnalysis(
    candles,
    (params) => createSMACrossoverStrategy({
      fastPeriod: params.fastPeriod,
      slowPeriod: params.slowPeriod
    }),
    [
      { name: "fastPeriod", min: 10, max: 30, step: 10 },
      { name: "slowPeriod", min: 40, max: 60, step: 10 }
    ],
    {
      trainingPeriods: 3,
      testingPeriods: 1,
      objective: "sharpeRatio"
    }
  );

  console.log("\n=== Walk-Forward Analysis Results ===");
  console.log(`Number of periods: ${walkForwardResult.results.length}`);
  console.log(`Average Return: ${walkForwardResult.avgReturn.toFixed(2)}%`);
  console.log(`Average Sharpe: ${walkForwardResult.avgSharpe.toFixed(2)}`);
  console.log(`Consistency: ${walkForwardResult.consistency.toFixed(2)}%`);

  // Example 4: Monte Carlo simulation
  console.log("\n🎲 Running Monte Carlo simulation...");
  const monteCarloResult = await runner.monteCarloSimulation(smaResult, 1000);

  console.log("\n=== Monte Carlo Simulation Results ===");
  console.log(`Average Final Capital: $${monteCarloResult.avgFinalCapital.toFixed(2)}`);
  console.log(`Best Case: $${monteCarloResult.bestCase.toFixed(2)}`);
  console.log(`Worst Case: $${monteCarloResult.worstCase.toFixed(2)}`);
  console.log(`95% Confidence Interval: $${monteCarloResult.confidenceInterval95[0].toFixed(2)} - $${monteCarloResult.confidenceInterval95[1].toFixed(2)}`);

  console.log("\n✅ Backtesting complete!");
}

main().catch(console.error);
