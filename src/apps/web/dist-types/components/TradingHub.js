import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { useTrading } from "../contexts/TradingContext.js";
import { CandlestickChart } from "./CandlestickChart.js";
import { MetricsPanel } from "./MetricsPanel.js";
import { BacktestPanel } from "./BacktestPanel.js";
import { LoadingSpinner } from "./LoadingSpinner.js";
export const TradingHub = memo(function TradingHub() {
    const { candles, metrics, isLoading, error, refreshMetrics } = useTrading();
    useEffect(() => {
        void refreshMetrics();
    }, [refreshMetrics]);
    // Transform candles to chart format
    const chartData = useMemo(() => {
        return candles.map((candle) => ({
            time: Math.floor(candle.timestamp / 1000),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close
        }));
    }, [candles]);
    return (_jsxs("div", { className: "trading-hub", children: [_jsx(motion.header, { className: "trading-hub-header", initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 }, children: _jsxs("div", { children: [_jsx("h1", { children: "Trading Hub" }), _jsx("p", { children: "An\u00E1lise de mercado em tempo real e backtesting de estrat\u00E9gias" })] }) }), _jsxs("div", { className: "trading-hub-content", children: [_jsxs("section", { className: "trading-hub-main", children: [_jsx(motion.div, { className: "chart-section", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: 0.1 }, children: _jsxs("div", { className: "panel", children: [_jsxs("header", { className: "panel-header", children: [_jsx("h2", { children: "Gr\u00E1fico de Candles" }), _jsxs("span", { className: "badge", children: [candles.length, " candle", candles.length !== 1 ? "s" : ""] })] }), candles.length === 0 ? (_jsxs("div", { style: { padding: "2rem", textAlign: "center" }, children: [_jsx("p", { className: "empty", children: "Aguardando dados de mercado via WebSocket..." }), _jsx(LoadingSpinner, { size: "small" })] })) : (_jsx(CandlestickChart, { data: chartData, symbol: "BTCUSDT", height: 400 }))] }) }), _jsx(MetricsPanel, {})] }), _jsx("aside", { className: "trading-hub-sidebar", children: _jsx(BacktestPanel, {}) })] })] }));
});
