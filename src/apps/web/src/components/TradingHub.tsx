import { useEffect, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { useTrading } from "../contexts/TradingContext.js";
import { CandlestickChart } from "./CandlestickChart.js";
import { MetricsPanel } from "./MetricsPanel.js";
import { BacktestPanel } from "./BacktestPanel.js";
import { LoadingSpinner } from "./LoadingSpinner.js";
import { ErrorMessage } from "./ErrorMessage.js";
import type { CandlestickData } from "lightweight-charts";

export const TradingHub = memo(function TradingHub() {
  const { candles, metrics, isLoading, error, refreshMetrics } = useTrading();

  useEffect(() => {
    void refreshMetrics();
  }, [refreshMetrics]);

  // Transform candles to chart format
  const chartData: CandlestickData[] = useMemo(() => {
    return candles.map((candle) => ({
      time: Math.floor(candle.timestamp / 1000) as any,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    }));
  }, [candles]);

  return (
    <div className="trading-hub">
      <motion.header
        className="trading-hub-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <h1>Trading Hub</h1>
          <p>Análise de mercado em tempo real e backtesting de estratégias</p>
        </div>
      </motion.header>

      <div className="trading-hub-content">
        <section className="trading-hub-main">
          <motion.div
            className="chart-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="panel">
              <header className="panel-header">
                <h2>Gráfico de Candles</h2>
                <span className="badge">
                  {candles.length} candle{candles.length !== 1 ? "s" : ""}
                </span>
              </header>

              {candles.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center" }}>
                  <p className="empty">
                    Aguardando dados de mercado via WebSocket...
                  </p>
                  <LoadingSpinner size="small" />
                </div>
              ) : (
                <CandlestickChart
                  data={chartData}
                  symbol="BTCUSDT"
                  height={400}
                />
              )}
            </div>
          </motion.div>

          <MetricsPanel />
        </section>

        <aside className="trading-hub-sidebar">
          <BacktestPanel />
        </aside>
      </div>
    </div>
  );
});
