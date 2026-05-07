import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Portfolio Metrics Component
 * Displays real-time portfolio performance with visual indicators
 */
import { memo } from "react";
import { motion } from "framer-motion";
export const PortfolioMetrics = memo(function PortfolioMetrics({ totalValue, totalPnL, pnlPercentage, openPositions }) {
    const formatCurrency = (value) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    };
    const formatPercentage = (value) => {
        const sign = value >= 0 ? "+" : "";
        return `${sign}${value.toFixed(2)}%`;
    };
    const getPnLColor = (value) => {
        if (value > 0)
            return "var(--positive)";
        if (value < 0)
            return "var(--negative)";
        return "var(--muted)";
    };
    return (_jsxs("div", { className: "portfolio-metrics", children: [_jsxs(motion.div, { className: "metric-item", initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.3 }, children: [_jsx("span", { className: "metric-label", children: "Portfolio Value" }), _jsx("span", { className: "metric-value", children: formatCurrency(totalValue) })] }), _jsxs(motion.div, { className: "metric-item", initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.3, delay: 0.05 }, children: [_jsx("span", { className: "metric-label", children: "Total PnL" }), _jsx("span", { className: "metric-value", style: { color: getPnLColor(totalPnL) }, children: formatCurrency(totalPnL) })] }), _jsxs(motion.div, { className: "metric-item", initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.3, delay: 0.1 }, children: [_jsx("span", { className: "metric-label", children: "PnL %" }), _jsx("span", { className: "metric-value", style: { color: getPnLColor(pnlPercentage) }, children: formatPercentage(pnlPercentage) })] }), _jsxs(motion.div, { className: "metric-item", initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.3, delay: 0.15 }, children: [_jsx("span", { className: "metric-label", children: "Open Positions" }), _jsx("span", { className: "metric-value", children: openPositions })] })] }));
});
