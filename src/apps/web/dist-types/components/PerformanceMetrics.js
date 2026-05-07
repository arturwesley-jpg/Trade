import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { formatCurrency, formatPercent } from "../view-model.js";
function MetricCard({ label, value, subtitle, trend = "neutral", index }) {
    const trendColors = {
        positive: "var(--positive)",
        negative: "var(--negative)",
        neutral: "var(--muted)"
    };
    return (_jsxs(motion.article, { className: "metric-card", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: index * 0.1, duration: 0.4, ease: "easeOut" }, children: [_jsx("span", { className: "metric-label", children: label }), _jsx("strong", { className: "metric-value", style: { color: trendColors[trend] }, children: value }), subtitle && _jsx("small", { className: "metric-subtitle", children: subtitle })] }));
}
export function PerformanceMetrics({ paperSummary }) {
    if (!paperSummary) {
        return (_jsxs("section", { className: "panel performance-metrics-panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "M\u00E9tricas de Performance" }), _jsx("h2", { children: "Dashboard de Resultados" })] }), _jsx("p", { className: "empty", children: "Nenhum dado de performance dispon\u00EDvel." })] }));
    }
    const sharpeRatio = calculateSharpeRatio(paperSummary);
    const maxDrawdown = calculateMaxDrawdown(paperSummary);
    const avgWin = paperSummary.closedTrades > 0 ? paperSummary.realizedPnlUsdt / paperSummary.closedTrades : 0;
    const profitFactor = calculateProfitFactor(paperSummary);
    const metrics = [
        {
            label: "Total P&L",
            value: formatCurrency(paperSummary.realizedPnlUsdt),
            subtitle: `${paperSummary.closedTrades} trades fechados`,
            trend: paperSummary.realizedPnlUsdt >= 0 ? "positive" : "negative"
        },
        {
            label: "Win Rate",
            value: formatPercent(paperSummary.winRatePct ?? 0),
            subtitle: "Taxa de acerto",
            trend: (paperSummary.winRatePct ?? 0) >= 50 ? "positive" : "negative"
        },
        {
            label: "Sharpe Ratio",
            value: sharpeRatio.toFixed(2),
            subtitle: "Retorno ajustado ao risco",
            trend: sharpeRatio >= 1 ? "positive" : sharpeRatio >= 0 ? "neutral" : "negative"
        },
        {
            label: "Max Drawdown",
            value: formatPercent(maxDrawdown),
            subtitle: "Maior queda",
            trend: maxDrawdown <= -10 ? "negative" : maxDrawdown <= -5 ? "neutral" : "positive"
        },
        {
            label: "Profit Factor",
            value: profitFactor.toFixed(2),
            subtitle: "Lucro / Prejuízo",
            trend: profitFactor >= 1.5 ? "positive" : profitFactor >= 1 ? "neutral" : "negative"
        },
        {
            label: "Média por Trade",
            value: formatCurrency(avgWin),
            subtitle: "P&L médio",
            trend: avgWin >= 0 ? "positive" : "negative"
        },
        {
            label: "Posições Abertas",
            value: paperSummary.openPositions,
            subtitle: "Exposição atual",
            trend: "neutral"
        },
        {
            label: "Total de Trades",
            value: paperSummary.closedTrades,
            subtitle: "Histórico completo",
            trend: "neutral"
        }
    ];
    return (_jsxs("section", { className: "panel performance-metrics-panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "M\u00E9tricas de Performance" }), _jsx("h2", { children: "Dashboard de Resultados" })] }), _jsx("div", { className: "metrics-grid", children: metrics.map((metric, index) => (_jsx(MetricCard, { label: metric.label, value: metric.value, subtitle: metric.subtitle, trend: metric.trend, index: index }, metric.label))) })] }));
}
// Helper functions for calculations
function calculateSharpeRatio(summary) {
    // Simplified Sharpe calculation (would need historical returns for accurate calculation)
    if (summary.closedTrades === 0)
        return 0;
    const avgReturn = summary.realizedPnlUsdt / summary.closedTrades;
    const estimatedStdDev = Math.abs(avgReturn) * 0.5; // Rough estimate
    return estimatedStdDev > 0 ? avgReturn / estimatedStdDev : 0;
}
function calculateMaxDrawdown(summary) {
    // Simplified drawdown (would need equity curve for accurate calculation)
    if (summary.realizedPnlUsdt >= 0)
        return 0;
    return (summary.realizedPnlUsdt / 10000) * 100; // Assuming 10k starting capital
}
function calculateProfitFactor(summary) {
    // Simplified profit factor
    if (summary.closedTrades === 0)
        return 0;
    const winRate = summary.winRatePct ?? 0;
    const wins = summary.closedTrades * (winRate / 100);
    const losses = summary.closedTrades - wins;
    if (losses === 0)
        return summary.realizedPnlUsdt > 0 ? 999 : 0;
    const grossProfit = wins * (summary.realizedPnlUsdt / summary.closedTrades);
    const grossLoss = Math.abs(losses * (summary.realizedPnlUsdt / summary.closedTrades));
    return grossLoss > 0 ? grossProfit / grossLoss : 0;
}
