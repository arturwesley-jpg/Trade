import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, memo } from "react";
import { motion } from "framer-motion";
import { useTrading } from "../contexts/TradingContext.js";
import { LoadingSpinner } from "./LoadingSpinner.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { formatCurrency, formatPercent } from "../view-model.js";
export const MetricsPanel = memo(function MetricsPanel() {
    const { metrics, isLoading, error, refreshMetrics } = useTrading();
    useEffect(() => {
        void refreshMetrics();
    }, [refreshMetrics]);
    if (isLoading && !metrics) {
        return (_jsx(motion.div, { className: "metrics-panel", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 }, children: _jsx("div", { className: "panel", children: _jsx(LoadingSpinner, { message: "Carregando m\u00E9tricas..." }) }) }));
    }
    if (error) {
        return (_jsx(motion.div, { className: "metrics-panel", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 }, children: _jsx("div", { className: "panel", children: _jsx(ErrorMessage, { title: "Erro ao carregar m\u00E9tricas", message: error, onRetry: refreshMetrics }) }) }));
    }
    if (!metrics) {
        return (_jsx(motion.div, { className: "metrics-panel", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 }, children: _jsxs("div", { className: "panel", children: [_jsxs("header", { className: "panel-header", children: [_jsx("h2", { children: "M\u00E9tricas de Performance" }), _jsx("button", { className: "btn btn-secondary", onClick: () => void refreshMetrics(), disabled: isLoading, "aria-label": "Atualizar m\u00E9tricas", children: isLoading ? "Atualizando..." : "Atualizar" })] }), _jsx("p", { className: "empty", style: { padding: "2rem", textAlign: "center" }, children: "Nenhuma m\u00E9trica dispon\u00EDvel. Execute alguns trades para ver as m\u00E9tricas." })] }) }));
    }
    const metricsData = [
        {
            label: "Total Return",
            value: formatCurrency(metrics.totalReturn || 0),
            trend: (metrics.totalReturn || 0) >= 0 ? "positive" : "negative"
        },
        {
            label: "Win Rate",
            value: formatPercent(metrics.winRate || 0),
            trend: (metrics.winRate || 0) >= 50 ? "positive" : "negative"
        },
        {
            label: "Sharpe Ratio",
            value: (metrics.sharpeRatio || 0).toFixed(2),
            trend: (metrics.sharpeRatio || 0) >= 1 ? "positive" : "neutral"
        },
        {
            label: "Max Drawdown",
            value: formatPercent(metrics.maxDrawdownPct || 0),
            trend: (metrics.maxDrawdownPct || 0) <= -10 ? "negative" : "neutral"
        },
        {
            label: "Total Trades",
            value: metrics.totalTrades || 0,
            trend: "neutral"
        },
        {
            label: "Profit Factor",
            value: (metrics.profitFactor || 0).toFixed(2),
            trend: (metrics.profitFactor || 0) >= 1.5 ? "positive" : "neutral"
        }
    ];
    return (_jsx(motion.div, { className: "metrics-panel", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 }, children: _jsxs("div", { className: "panel", children: [_jsxs("header", { className: "panel-header", children: [_jsx("h2", { children: "M\u00E9tricas de Performance" }), _jsx("button", { className: "btn btn-secondary", onClick: () => void refreshMetrics(), disabled: isLoading, "aria-label": "Atualizar m\u00E9tricas", children: isLoading ? "Atualizando..." : "Atualizar" })] }), _jsx("div", { className: "metrics-grid", children: metricsData.map((metric, index) => (_jsxs(motion.div, { className: `metric-card ${metric.trend}`, initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, transition: { delay: index * 0.05, duration: 0.2 }, children: [_jsx("span", { className: "metric-label", children: metric.label }), _jsx("strong", { className: "metric-value", children: metric.value })] }, metric.label))) })] }) }));
});
