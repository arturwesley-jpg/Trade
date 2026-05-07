import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
export const AdvancedTradingDashboard = memo(function AdvancedTradingDashboard({ symbol = "BTCUSDT", theme = "dark" }) {
    const { candles, metrics, signals, positions, isLoading } = useTrading();
    const [selectedTimeframe, setSelectedTimeframe] = useState("15m");
    const [chartType, setChartType] = useState("candlestick");
    const [showIndicators, setShowIndicators] = useState({
        ema: true,
        rsi: true,
        macd: false,
        volume: true
    });
    const [currentTheme, setCurrentTheme] = useState(theme);
    const [showPositions, setShowPositions] = useState(true);
    const [showAlerts, setShowAlerts] = useState(true);
    const [showSentiment, setShowSentiment] = useState(true);
    const toast = useToast();
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
    // Calculate portfolio summary
    const portfolioSummary = useMemo(() => {
        const totalValue = positions.reduce((sum, pos) => sum + pos.marginUsdt * pos.leverage, 0);
        const totalPnL = positions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0);
        const openPositions = positions.filter((p) => p.status === "OPEN").length;
        return {
            totalValue,
            totalPnL,
            openPositions,
            pnlPercentage: totalValue > 0 ? (totalPnL / totalValue) * 100 : 0
        };
    }, [positions]);
    // Get active signals
    const activeSignals = useMemo(() => {
        return signals.filter((s) => s.status === "ACTIVE" || s.status === "WATCH").slice(0, 5);
    }, [signals]);
    // Generate equity curve data from positions
    const equityCurveData = useMemo(() => {
        const startingEquity = 10000;
        let currentEquity = startingEquity;
        const data = [{ timestamp: Date.now() - 86400000 * 30, equity: startingEquity }];
        positions.forEach((pos, index) => {
            currentEquity += pos.unrealizedPnl || 0;
            data.push({
                timestamp: Date.now() - 86400000 * (30 - index),
                equity: currentEquity
            });
        });
        return data;
    }, [positions]);
    const handleClosePosition = (id) => {
        toast.success(`Position ${id} closed successfully`);
    };
    const handleEditPosition = (id) => {
        toast.info(`Editing position ${id}`);
    };
    const timeframes = [
        { value: "1m", label: "1m" },
        { value: "5m", label: "5m" },
        { value: "15m", label: "15m" },
        { value: "1h", label: "1h" },
        { value: "4h", label: "4h" },
        { value: "1d", label: "1D" }
    ];
    return (_jsxs("div", { className: `advanced-trading-dashboard theme-${currentTheme}`, children: [_jsxs(motion.div, { className: "dashboard-header", initial: { opacity: 0, y: -20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 }, children: [_jsxs("div", { className: "header-left", children: [_jsx("h1", { className: "dashboard-title", children: "Trading Dashboard" }), _jsxs("div", { className: "symbol-selector", children: [_jsx("span", { className: "symbol-badge", children: symbol }), _jsx("span", { className: "symbol-price", children: candles.length > 0 ? `$${candles[candles.length - 1].close.toLocaleString()}` : "—" }), candles.length > 1 && (_jsxs("span", { className: `price-change ${candles[candles.length - 1].close >= candles[candles.length - 2].close ? "positive" : "negative"}`, children: [((candles[candles.length - 1].close - candles[candles.length - 2].close) / candles[candles.length - 2].close * 100).toFixed(2), "%"] }))] })] }), _jsxs("div", { className: "header-right", children: [_jsx(PortfolioMetrics, { totalValue: portfolioSummary.totalValue, totalPnL: portfolioSummary.totalPnL, pnlPercentage: portfolioSummary.pnlPercentage, openPositions: portfolioSummary.openPositions }), _jsx(ThemeToggle, { theme: currentTheme, onToggle: setCurrentTheme })] })] }), _jsxs("div", { className: "trading-grid", children: [_jsxs("div", { className: "trading-grid-main", children: [_jsxs(motion.div, { className: "chart-container", initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.4, delay: 0.1 }, children: [_jsxs("div", { className: "chart-controls", children: [_jsx("div", { className: "timeframe-selector", children: timeframes.map((tf) => (_jsx("button", { className: `timeframe-btn ${selectedTimeframe === tf.value ? "active" : ""}`, onClick: () => setSelectedTimeframe(tf.value), children: tf.label }, tf.value))) }), _jsxs("div", { className: "chart-type-selector", children: [_jsx("button", { className: `chart-type-btn ${chartType === "candlestick" ? "active" : ""}`, onClick: () => setChartType("candlestick"), title: "Candlestick Chart", children: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 20 20", fill: "currentColor", children: [_jsx("rect", { x: "8", y: "2", width: "4", height: "16" }), _jsx("rect", { x: "6", y: "6", width: "8", height: "8" })] }) }), _jsx("button", { className: `chart-type-btn ${chartType === "line" ? "active" : ""}`, onClick: () => setChartType("line"), title: "Line Chart", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("polyline", { points: "2,15 6,10 10,12 14,6 18,8" }) }) })] }), _jsxs("div", { className: "indicator-toggles", children: [_jsx("button", { className: `indicator-btn ${showIndicators.ema ? "active" : ""}`, onClick: () => setShowIndicators(prev => ({ ...prev, ema: !prev.ema })), children: "EMA" }), _jsx("button", { className: `indicator-btn ${showIndicators.rsi ? "active" : ""}`, onClick: () => setShowIndicators(prev => ({ ...prev, rsi: !prev.rsi })), children: "RSI" }), _jsx("button", { className: `indicator-btn ${showIndicators.macd ? "active" : ""}`, onClick: () => setShowIndicators(prev => ({ ...prev, macd: !prev.macd })), children: "MACD" }), _jsx("button", { className: `indicator-btn ${showIndicators.volume ? "active" : ""}`, onClick: () => setShowIndicators(prev => ({ ...prev, volume: !prev.volume })), children: "Volume" })] })] }), candles.length === 0 ? (_jsxs("div", { className: "chart-loading", children: [_jsx("div", { className: "loading-spinner" }), _jsx("p", { children: "Aguardando dados de mercado..." })] })) : (_jsx(CandlestickChart, { data: chartData, symbol: symbol, height: 500 }))] }), _jsxs(motion.div, { className: "signals-panel", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: 0.2 }, children: [_jsxs("div", { className: "panel-header", children: [_jsx("h3", { children: "Active Signals" }), _jsx("span", { className: "signal-count", children: activeSignals.length })] }), _jsxs("div", { className: "signals-grid", children: [_jsx(AnimatePresence, { mode: "popLayout", children: activeSignals.map((signal, index) => (_jsx(SignalCard, { signal: signal, index: index }, signal.id))) }), activeSignals.length === 0 && (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "Nenhum sinal ativo no momento" }) }))] })] })] }), _jsxs("div", { className: "trading-grid-sidebar", children: [_jsx(motion.div, { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.4, delay: 0.15 }, children: _jsx(TradingPanel, { symbol: symbol }) }), _jsx(motion.div, { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.4, delay: 0.2 }, children: _jsx(OrderBook, { symbol: symbol }) }), _jsx(motion.div, { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.4, delay: 0.25 }, children: _jsx(MarketDepth, { symbol: symbol }) })] })] }), showPositions && positions.length > 0 && (_jsxs(motion.div, { className: "positions-section", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: 0.3 }, children: [_jsxs("div", { className: "section-header", children: [_jsx("h2", { children: "Open Positions" }), _jsx("button", { className: "toggle-section-btn", onClick: () => setShowPositions(false), "aria-label": "Hide positions", children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("polyline", { points: "18 15 12 9 6 15" }) }) })] }), _jsx("div", { className: "positions-grid", children: _jsx(AnimatePresence, { mode: "popLayout", children: positions.filter((p) => p.status === "OPEN").map((position) => (_jsx(PositionCard, { position: position, onClose: handleClosePosition, onEdit: handleEditPosition }, position.id))) }) })] })), equityCurveData.length > 1 && (_jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: 0.35 }, children: _jsx(EquityCurveChart, { data: equityCurveData, height: 300 }) })), showAlerts && (_jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: 0.4 }, children: _jsx(AlertManagementPanel, { symbol: symbol }) })), showSentiment && (_jsx(motion.div, { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: 0.45 }, children: _jsx(SentimentDashboard, {}) })), _jsx(ToastNotification, { toasts: toast.toasts, onRemove: toast.removeToast })] }));
});
