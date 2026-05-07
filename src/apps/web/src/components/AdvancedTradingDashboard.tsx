/**
 * Advanced Trading Dashboard
 * Professional trading interface with real-time data, advanced charts, and actionable insights
 */

import { memo, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTrading } from "../contexts/TradingContext.js";
import { CandlestickChart } from "./CandlestickChart.js";
import { SignalCard } from "./SignalCard.js";
import { PortfolioMetrics } from "./PortfolioMetrics.js";
import { OrderBook } from "./OrderBook.js";
import { TradingPanel } from "./TradingPanel.js";
import { MarketDepth } from "./MarketDepth.js";
import { ThemeToggle } from "./ThemeToggle.js";
import { ToastNotification, useToast } from "./ToastNotification.js";
import { PositionCard } from "./PositionCard.js";
import { EquityCurveChart } from "./EquityCurveChart.js";
import { AlertManagementPanel } from "./AlertManagementPanel.js";
import { SentimentDashboard } from "./SentimentDashboard.js";
import type { CandlestickData } from "lightweight-charts";

interface AdvancedTradingDashboardProps {
  symbol?: string;
  theme?: "dark" | "light";
}

export const AdvancedTradingDashboard = memo(function AdvancedTradingDashboard({
  symbol = "BTCUSDT",
  theme = "dark"
}: AdvancedTradingDashboardProps) {
  const { candles, metrics, signals, positions, isLoading } = useTrading();
  const [selectedTimeframe, setSelectedTimeframe] = useState<"1m" | "5m" | "15m" | "1h" | "4h" | "1d">("15m");
  const [chartType, setChartType] = useState<"candlestick" | "line" | "area">("candlestick");
  const [showIndicators, setShowIndicators] = useState({
    ema: true,
    rsi: true,
    macd: false,
    volume: true
  });
  const [currentTheme, setCurrentTheme] = useState<"dark" | "light">(theme);
  const [showPositions, setShowPositions] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showSentiment, setShowSentiment] = useState(true);
  const toast = useToast();

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

  // Calculate portfolio summary
  const portfolioSummary = useMemo(() => {
    const totalValue = positions.reduce((sum: number, pos: any) => sum + pos.marginUsdt * pos.leverage, 0);
    const totalPnL = positions.reduce((sum: number, pos: any) => sum + (pos.unrealizedPnl || 0), 0);
    const openPositions = positions.filter((p: any) => p.status === "OPEN").length;

    return {
      totalValue,
      totalPnL,
      openPositions,
      pnlPercentage: totalValue > 0 ? (totalPnL / totalValue) * 100 : 0
    };
  }, [positions]);

  // Get active signals
  const activeSignals = useMemo(() => {
    return signals.filter((s: any) => s.status === "ACTIVE" || s.status === "WATCH").slice(0, 5);
  }, [signals]);

  // Generate equity curve data from positions
  const equityCurveData = useMemo(() => {
    const startingEquity = 10000;
    let currentEquity = startingEquity;
    const data = [{ timestamp: Date.now() - 86400000 * 30, equity: startingEquity }];

    positions.forEach((pos: any, index: number) => {
      currentEquity += pos.unrealizedPnl || 0;
      data.push({
        timestamp: Date.now() - 86400000 * (30 - index),
        equity: currentEquity
      });
    });

    return data;
  }, [positions]);

  const handleClosePosition = (id: string) => {
    toast.success(`Position ${id} closed successfully`);
  };

  const handleEditPosition = (id: string) => {
    toast.info(`Editing position ${id}`);
  };

  const timeframes = [
    { value: "1m", label: "1m" },
    { value: "5m", label: "5m" },
    { value: "15m", label: "15m" },
    { value: "1h", label: "1h" },
    { value: "4h", label: "4h" },
    { value: "1d", label: "1D" }
  ] as const;

  return (
    <div className={`advanced-trading-dashboard theme-${currentTheme}`}>
      {/* Header with Portfolio Summary */}
      <motion.div
        className="dashboard-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="header-left">
          <h1 className="dashboard-title">Trading Dashboard</h1>
          <div className="symbol-selector">
            <span className="symbol-badge">{symbol}</span>
            <span className="symbol-price">
              {candles.length > 0 ? `$${candles[candles.length - 1].close.toLocaleString()}` : "—"}
            </span>
            {candles.length > 1 && (
              <span className={`price-change ${candles[candles.length - 1].close >= candles[candles.length - 2].close ? "positive" : "negative"}`}>
                {((candles[candles.length - 1].close - candles[candles.length - 2].close) / candles[candles.length - 2].close * 100).toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        <div className="header-right">
          <PortfolioMetrics
            totalValue={portfolioSummary.totalValue}
            totalPnL={portfolioSummary.totalPnL}
            pnlPercentage={portfolioSummary.pnlPercentage}
            openPositions={portfolioSummary.openPositions}
          />
          <ThemeToggle theme={currentTheme} onToggle={setCurrentTheme} />
        </div>
      </motion.div>

      {/* Main Trading Grid */}
      <div className="trading-grid">
        {/* Left Column - Chart and Indicators */}
        <div className="trading-grid-main">
          <motion.div
            className="chart-container"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="chart-controls">
              <div className="timeframe-selector">
                {timeframes.map((tf) => (
                  <button
                    key={tf.value}
                    className={`timeframe-btn ${selectedTimeframe === tf.value ? "active" : ""}`}
                    onClick={() => setSelectedTimeframe(tf.value)}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              <div className="chart-type-selector">
                <button
                  className={`chart-type-btn ${chartType === "candlestick" ? "active" : ""}`}
                  onClick={() => setChartType("candlestick")}
                  title="Candlestick Chart"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <rect x="8" y="2" width="4" height="16" />
                    <rect x="6" y="6" width="8" height="8" />
                  </svg>
                </button>
                <button
                  className={`chart-type-btn ${chartType === "line" ? "active" : ""}`}
                  onClick={() => setChartType("line")}
                  title="Line Chart"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="2,15 6,10 10,12 14,6 18,8" />
                  </svg>
                </button>
              </div>

              <div className="indicator-toggles">
                <button
                  className={`indicator-btn ${showIndicators.ema ? "active" : ""}`}
                  onClick={() => setShowIndicators(prev => ({ ...prev, ema: !prev.ema }))}
                >
                  EMA
                </button>
                <button
                  className={`indicator-btn ${showIndicators.rsi ? "active" : ""}`}
                  onClick={() => setShowIndicators(prev => ({ ...prev, rsi: !prev.rsi }))}
                >
                  RSI
                </button>
                <button
                  className={`indicator-btn ${showIndicators.macd ? "active" : ""}`}
                  onClick={() => setShowIndicators(prev => ({ ...prev, macd: !prev.macd }))}
                >
                  MACD
                </button>
                <button
                  className={`indicator-btn ${showIndicators.volume ? "active" : ""}`}
                  onClick={() => setShowIndicators(prev => ({ ...prev, volume: !prev.volume }))}
                >
                  Volume
                </button>
              </div>
            </div>

            {candles.length === 0 ? (
              <div className="chart-loading">
                <div className="loading-spinner" />
                <p>Aguardando dados de mercado...</p>
              </div>
            ) : (
              <CandlestickChart
                data={chartData}
                symbol={symbol}
                height={500}
              />
            )}
          </motion.div>

          {/* Signals Panel */}
          <motion.div
            className="signals-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="panel-header">
              <h3>Active Signals</h3>
              <span className="signal-count">{activeSignals.length}</span>
            </div>
            <div className="signals-grid">
              <AnimatePresence mode="popLayout">
                {activeSignals.map((signal: any, index: number) => (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    index={index}
                  />
                ))}
              </AnimatePresence>
              {activeSignals.length === 0 && (
                <div className="empty-state">
                  <p>Nenhum sinal ativo no momento</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column - Order Book, Trading Panel, Market Depth */}
        <div className="trading-grid-sidebar">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <TradingPanel symbol={symbol} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <OrderBook symbol={symbol} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <MarketDepth symbol={symbol} />
          </motion.div>
        </div>
      </div>

      {/* Positions Section */}
      {showPositions && positions.length > 0 && (
        <motion.div
          className="positions-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="section-header">
            <h2>Open Positions</h2>
            <button
              className="toggle-section-btn"
              onClick={() => setShowPositions(false)}
              aria-label="Hide positions"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          </div>
          <div className="positions-grid">
            <AnimatePresence mode="popLayout">
              {positions.filter((p: any) => p.status === "OPEN").map((position: any) => (
                <PositionCard
                  key={position.id}
                  position={position}
                  onClose={handleClosePosition}
                  onEdit={handleEditPosition}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Equity Curve */}
      {equityCurveData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <EquityCurveChart data={equityCurveData} height={300} />
        </motion.div>
      )}

      {/* Alert Management */}
      {showAlerts && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <AlertManagementPanel symbol={symbol} />
        </motion.div>
      )}

      {/* Sentiment Dashboard */}
      {showSentiment && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
        >
          <SentimentDashboard />
        </motion.div>
      )}

      {/* Toast Notifications */}
      <ToastNotification toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
});
