import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { formatCurrency } from "../view-model.js";
export function PositionsTable({ positions }) {
    if (positions.length === 0) {
        return (_jsxs("section", { className: "panel positions-table-panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Posi\u00E7\u00F5es Ativas" }), _jsx("h2", { children: "Exposi\u00E7\u00E3o Atual" })] }), _jsx("p", { className: "empty", children: "Nenhuma posi\u00E7\u00E3o paper aberta." })] }));
    }
    return (_jsxs("section", { className: "panel positions-table-panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Posi\u00E7\u00F5es Ativas" }), _jsxs("h2", { children: ["Exposi\u00E7\u00E3o Atual (", positions.length, ")"] })] }), _jsx("div", { className: "table-wrapper", children: _jsxs("table", { className: "enhanced-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Ativo" }), _jsx("th", { children: "Lado" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Entrada" }), _jsx("th", { children: "Stop Loss" }), _jsx("th", { children: "Take Profit" }), _jsx("th", { children: "Margem" }), _jsx("th", { children: "Alavancagem" }), _jsx("th", { children: "P&L N\u00E3o Realizado" })] }) }), _jsx("tbody", { children: positions.map((position, index) => {
                                const unrealizedPnl = calculateUnrealizedPnL(position);
                                const pnlClass = unrealizedPnl >= 0 ? "positive" : "negative";
                                return (_jsxs(motion.tr, { initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, transition: { delay: index * 0.05, duration: 0.3 }, children: [_jsx("td", { className: "symbol-cell", children: position.symbol }), _jsx("td", { children: _jsx("span", { className: `badge ${position.side.toLowerCase()}`, children: position.side }) }), _jsx("td", { children: _jsx("span", { className: `badge ${position.status.toLowerCase()}`, children: position.status }) }), _jsx("td", { children: formatCurrency(position.entryPrice) }), _jsx("td", { className: "negative", children: formatCurrency(position.stopLossPrice ?? 0) }), _jsx("td", { className: "positive", children: formatCurrency(position.takeProfitPrice ?? 0) }), _jsx("td", { children: formatCurrency(position.marginUsdt ?? 0) }), _jsx("td", { children: _jsxs("span", { className: "leverage-badge", children: [position.leverage ?? 1, "x"] }) }), _jsx("td", { className: pnlClass, children: _jsx("strong", { children: formatCurrency(unrealizedPnl) }) })] }, position.id));
                            }) })] }) })] }));
}
function calculateUnrealizedPnL(position) {
    // Simplified P&L calculation (would need current price for accurate calculation)
    // This is a placeholder - in real implementation, you'd get current price from market data
    const estimatedCurrentPrice = position.entryPrice * 1.02; // Assume 2% gain for demo
    const priceDiff = estimatedCurrentPrice - position.entryPrice;
    const positionSize = (position.marginUsdt ?? 0) * (position.leverage ?? 1);
    return (priceDiff / position.entryPrice) * positionSize;
}
