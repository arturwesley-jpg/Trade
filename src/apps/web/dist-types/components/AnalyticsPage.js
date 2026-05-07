import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense, useEffect } from "react";
import { motion } from "framer-motion";
import { useTrading } from "../contexts/TradingContext.js";
import { LoadingSpinner } from "./LoadingSpinner.js";
// Lazy load heavy chart components
const CandlestickChart = lazy(() => import("./CandlestickChart.js").then(m => ({ default: m.CandlestickChart })));
const EquityCurve = lazy(() => import("./EquityCurve.js").then(m => ({ default: m.EquityCurve })));
const PerformanceMetrics = lazy(() => import("./PerformanceMetrics.js").then(m => ({ default: m.PerformanceMetrics })));
const PositionsTable = lazy(() => import("./PositionsTable.js").then(m => ({ default: m.PositionsTable })));
const TradesHistory = lazy(() => import("./TradesHistory.js").then(m => ({ default: m.TradesHistory })));
const BacktestPanel = lazy(() => import("./BacktestPanel.js").then(m => ({ default: m.BacktestPanel })));
function ChartSkeleton() {
    return (_jsx("div", { className: "panel", style: { minHeight: "400px" }, children: _jsx("div", { className: "skeleton-loader", style: { height: "100%", width: "100%" } }) }));
}
export function AnalyticsPage({ positions, paperSummary }) {
    const { candles, metrics, backtests, isLoading, loadBacktests, refreshMetrics } = useTrading();
    // Load data on mount
    useEffect(() => {
        loadBacktests();
        refreshMetrics();
    }, [loadBacktests, refreshMetrics]);
    // Convert candles to candlestick chart format (lightweight-charts expects time as unix timestamp in seconds)
    const candlestickData = candles.map(candle => ({
        time: Math.floor(new Date(candle.timestamp).getTime() / 1000),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
    }));
    // Generate equity curve from metrics (lightweight-charts expects time/value format)
    const equityCurveData = metrics ? [
        { time: Math.floor(Date.now() / 1000), value: metrics.totalReturn }
    ] : [];
    return (_jsxs(motion.div, { className: "analytics-page", initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.4 }, children: [_jsx("header", { className: "page-header", children: _jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "Analytics" }), _jsx("h1", { children: "Dashboard de Performance" })] }) }), isLoading && candles.length === 0 ? (_jsx(LoadingSpinner, { message: "Carregando dados...", fullScreen: false })) : (_jsxs("div", { className: "analytics-grid", children: [_jsx("section", { className: "analytics-section full-width", children: _jsx(Suspense, { fallback: _jsx(ChartSkeleton, {}), children: _jsx(PerformanceMetrics, { paperSummary: paperSummary }) }) }), candlestickData.length > 0 && (_jsx("section", { className: "analytics-section", children: _jsx(Suspense, { fallback: _jsx(ChartSkeleton, {}), children: _jsx(CandlestickChart, { data: candlestickData, symbol: "BTCUSDT", height: 450 }) }) })), equityCurveData.length > 0 && (_jsx("section", { className: "analytics-section", children: _jsx(Suspense, { fallback: _jsx(ChartSkeleton, {}), children: _jsx(EquityCurve, { data: equityCurveData, height: 450 }) }) })), _jsx("section", { className: "analytics-section full-width", children: _jsx(Suspense, { fallback: _jsx(ChartSkeleton, {}), children: _jsx(BacktestPanel, {}) }) }), _jsx("section", { className: "analytics-section full-width", children: _jsx(Suspense, { fallback: _jsx(ChartSkeleton, {}), children: _jsx(PositionsTable, { positions: positions }) }) }), _jsx("section", { className: "analytics-section full-width", children: _jsx(Suspense, { fallback: _jsx(ChartSkeleton, {}), children: _jsx(TradesHistory, { trades: [] }) }) })] }))] }));
}
