import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Position Card Component
 * Displays individual position with TP/SL visualization and real-time PnL
 */
import { memo } from "react";
import { motion } from "framer-motion";
export const PositionCard = memo(function PositionCard({ position, onClose, onEdit }) {
    const getPnLColor = (pnl) => {
        if (pnl > 0)
            return "var(--positive)";
        if (pnl < 0)
            return "var(--negative)";
        return "var(--muted)";
    };
    const getSideColor = (side) => {
        return side === "LONG" ? "var(--positive)" : "var(--negative)";
    };
    const calculatePriceRange = () => {
        const prices = [
            position.entryPrice,
            position.currentPrice,
            position.takeProfit,
            position.stopLoss
        ].filter((p) => p !== undefined);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min;
        const padding = range * 0.1;
        return { min: min - padding, max: max + padding, range: range + padding * 2 };
    };
    const getPositionOnScale = (price) => {
        const { min, range } = calculatePriceRange();
        return ((price - min) / range) * 100;
    };
    return (_jsxs(motion.div, { className: "position-card", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, scale: 0.95 }, transition: { duration: 0.3 }, style: { borderLeft: `3px solid ${getSideColor(position.side)}` }, children: [_jsxs("div", { className: "position-header", children: [_jsxs("div", { className: "position-symbol", children: [_jsx("span", { className: "symbol-text", children: position.symbol }), _jsx("span", { className: "side-badge", style: { backgroundColor: getSideColor(position.side) }, children: position.side }), _jsxs("span", { className: "leverage-badge", children: [position.leverage, "x"] })] }), _jsxs("div", { className: "position-actions", children: [onEdit && (_jsx("button", { className: "position-action-btn", onClick: () => onEdit(position.id), "aria-label": "Edit position", title: "Edit", children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), _jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })] }) })), onClose && (_jsx("button", { className: "position-action-btn close", onClick: () => onClose(position.id), "aria-label": "Close position", title: "Close", children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) }))] })] }), _jsxs("div", { className: "position-prices", children: [_jsxs("div", { className: "price-item", children: [_jsx("span", { className: "price-label", children: "Entry" }), _jsxs("span", { className: "price-value", children: ["$", position.entryPrice.toLocaleString()] })] }), _jsxs("div", { className: "price-item", children: [_jsx("span", { className: "price-label", children: "Current" }), _jsxs("span", { className: "price-value", children: ["$", position.currentPrice.toLocaleString()] })] }), _jsxs("div", { className: "price-item", children: [_jsx("span", { className: "price-label", children: "Size" }), _jsx("span", { className: "price-value", children: position.size.toFixed(4) })] })] }), _jsx("div", { className: "position-scale", children: _jsxs("div", { className: "scale-track", children: [position.takeProfit && (_jsxs("div", { className: "scale-marker tp", style: { left: `${getPositionOnScale(position.takeProfit)}%` }, title: `TP: $${position.takeProfit.toLocaleString()}`, children: [_jsx("div", { className: "marker-line" }), _jsx("div", { className: "marker-label", children: "TP" })] })), _jsxs("div", { className: "scale-marker entry", style: { left: `${getPositionOnScale(position.entryPrice)}%` }, title: `Entry: $${position.entryPrice.toLocaleString()}`, children: [_jsx("div", { className: "marker-line" }), _jsx("div", { className: "marker-label", children: "Entry" })] }), _jsxs(motion.div, { className: "scale-marker current", style: { left: `${getPositionOnScale(position.currentPrice)}%` }, animate: { left: `${getPositionOnScale(position.currentPrice)}%` }, transition: { type: "spring", stiffness: 300, damping: 30 }, title: `Current: $${position.currentPrice.toLocaleString()}`, children: [_jsx("div", { className: "marker-line" }), _jsx("div", { className: "marker-label", children: "Now" })] }), position.stopLoss && (_jsxs("div", { className: "scale-marker sl", style: { left: `${getPositionOnScale(position.stopLoss)}%` }, title: `SL: $${position.stopLoss.toLocaleString()}`, children: [_jsx("div", { className: "marker-line" }), _jsx("div", { className: "marker-label", children: "SL" })] }))] }) }), _jsxs("div", { className: "position-pnl", children: [_jsxs("div", { className: "pnl-item", children: [_jsx("span", { className: "pnl-label", children: "Unrealized PnL" }), _jsxs("span", { className: "pnl-value", style: { color: getPnLColor(position.unrealizedPnl) }, children: ["$", position.unrealizedPnl.toFixed(2)] })] }), _jsxs("div", { className: "pnl-item", children: [_jsx("span", { className: "pnl-label", children: "PnL %" }), _jsxs("span", { className: "pnl-value", style: { color: getPnLColor(position.unrealizedPnlPct) }, children: [position.unrealizedPnlPct > 0 ? "+" : "", position.unrealizedPnlPct.toFixed(2), "%"] })] }), _jsxs("div", { className: "pnl-item", children: [_jsx("span", { className: "pnl-label", children: "Margin" }), _jsxs("span", { className: "pnl-value", children: ["$", position.marginUsdt.toFixed(2)] })] })] })] }));
});
