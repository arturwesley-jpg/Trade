import { lazy, Suspense, useEffect } from "react";
import { motion } from "framer-motion";
import type { Position, PaperSummary } from "../shared-types.js";
import type { CandlestickData, LineData } from "lightweight-charts";
import { useTrading } from "../contexts/TradingContext.js";
import { LoadingSpinner } from "./LoadingSpinner.js";

// Lazy load heavy chart components
const CandlestickChart = lazy(() => import("./CandlestickChart.js").then(m => ({ default: m.CandlestickChart })));
const EquityCurve = lazy(() => import("./EquityCurve.js").then(m => ({ default: m.EquityCurve })));
const PerformanceMetrics = lazy(() => import("./PerformanceMetrics.js").then(m => ({ default: m.PerformanceMetrics })));
const PositionsTable = lazy(() => import("./PositionsTable.js").then(m => ({ default: m.PositionsTable })));
const TradesHistory = lazy(() => import("./TradesHistory.js").then(m => ({ default: m.TradesHistory })));
const BacktestPanel = lazy(() => import("./BacktestPanel.js").then(m => ({ default: m.BacktestPanel })));

export interface AnalyticsPageProps {
  positions: Position[];
  paperSummary: PaperSummary | null;
}

function ChartSkeleton() {
  return (
    <div className="panel" style={{ minHeight: "400px" }}>
      <div className="skeleton-loader" style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

export function AnalyticsPage({ positions, paperSummary }: AnalyticsPageProps) {
  const { candles, metrics, backtests, isLoading, loadBacktests, refreshMetrics } = useTrading();

  // Load data on mount
  useEffect(() => {
    loadBacktests();
    refreshMetrics();
  }, [loadBacktests, refreshMetrics]);

  // Convert candles to candlestick chart format (lightweight-charts expects time as unix timestamp in seconds)
  const candlestickData: CandlestickData[] = candles.map(candle => ({
    time: Math.floor(new Date(candle.timestamp).getTime() / 1000) as any,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close
  }));

  // Generate equity curve from metrics (lightweight-charts expects time/value format)
  const equityCurveData: LineData[] = metrics ? [
    { time: Math.floor(Date.now() / 1000) as any, value: metrics.totalReturn }
  ] : [];

  return (
    <motion.div
      className="analytics-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <header className="page-header">
        <div>
          <span className="eyebrow">Analytics</span>
          <h1>Dashboard de Performance</h1>
        </div>
      </header>

      {isLoading && candles.length === 0 ? (
        <LoadingSpinner message="Carregando dados..." fullScreen={false} />
      ) : (
        <div className="analytics-grid">
          {/* Performance Metrics */}
          <section className="analytics-section full-width">
            <Suspense fallback={<ChartSkeleton />}>
              <PerformanceMetrics paperSummary={paperSummary} />
            </Suspense>
          </section>

          {/* Charts Row */}
          {candlestickData.length > 0 && (
            <section className="analytics-section">
              <Suspense fallback={<ChartSkeleton />}>
                <CandlestickChart data={candlestickData} symbol="BTCUSDT" height={450} />
              </Suspense>
            </section>
          )}

          {equityCurveData.length > 0 && (
            <section className="analytics-section">
              <Suspense fallback={<ChartSkeleton />}>
                <EquityCurve data={equityCurveData} height={450} />
              </Suspense>
            </section>
          )}

          {/* Backtest Panel */}
          <section className="analytics-section full-width">
            <Suspense fallback={<ChartSkeleton />}>
              <BacktestPanel />
            </Suspense>
          </section>

          {/* Positions Table */}
          <section className="analytics-section full-width">
            <Suspense fallback={<ChartSkeleton />}>
              <PositionsTable positions={positions} />
            </Suspense>
          </section>

          {/* Trades History */}
          <section className="analytics-section full-width">
            <Suspense fallback={<ChartSkeleton />}>
              <TradesHistory trades={[]} />
            </Suspense>
          </section>
        </div>
      )}
    </motion.div>
  );
}
