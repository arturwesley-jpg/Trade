import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { formatCurrency, formatPercent } from "../view-model.js";
export function TradesHistory({ trades }) {
    const [filter, setFilter] = useState("all");
    const [sortField, setSortField] = useState("exitTime");
    const [sortOrder, setSortOrder] = useState("desc");
    const [searchQuery, setSearchQuery] = useState("");
    const filteredAndSortedTrades = useMemo(() => {
        let result = [...trades];
        // Apply filter
        if (filter === "wins") {
            result = result.filter((t) => t.status === "WIN");
        }
        else if (filter === "losses") {
            result = result.filter((t) => t.status === "LOSS");
        }
        // Apply search
        if (searchQuery) {
            result = result.filter((t) => t.symbol.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        // Apply sort
        result.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            const multiplier = sortOrder === "asc" ? 1 : -1;
            return (aVal > bVal ? 1 : -1) * multiplier;
        });
        return result;
    }, [trades, filter, sortField, sortOrder, searchQuery]);
    const stats = useMemo(() => {
        const wins = trades.filter((t) => t.status === "WIN").length;
        const losses = trades.filter((t) => t.status === "LOSS").length;
        const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
        return { wins, losses, totalPnl, total: trades.length };
    }, [trades]);
    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        }
        else {
            setSortField(field);
            setSortOrder("desc");
        }
    };
    if (trades.length === 0) {
        return (_jsxs("section", { className: "panel trades-history-panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsx("span", { className: "eyebrow", children: "Hist\u00F3rico de Trades" }), _jsx("h2", { children: "Opera\u00E7\u00F5es Fechadas" })] }), _jsx("p", { className: "empty", children: "Nenhum trade fechado ainda." })] }));
    }
    return (_jsxs("section", { className: "panel trades-history-panel", children: [_jsxs("div", { className: "panel-heading", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "Hist\u00F3rico de Trades" }), _jsxs("h2", { children: ["Opera\u00E7\u00F5es Fechadas (", trades.length, ")"] })] }), _jsxs("div", { className: "trades-stats", children: [_jsxs("span", { className: "stat positive", children: [stats.wins, " Wins"] }), _jsxs("span", { className: "stat negative", children: [stats.losses, " Losses"] }), _jsxs("span", { className: "stat", children: ["Total: ", formatCurrency(stats.totalPnl)] })] })] }), _jsxs("div", { className: "trades-controls", children: [_jsxs("div", { className: "filter-buttons", children: [_jsxs("button", { className: `filter-btn ${filter === "all" ? "active" : ""}`, onClick: () => setFilter("all"), type: "button", children: ["Todos (", trades.length, ")"] }), _jsxs("button", { className: `filter-btn ${filter === "wins" ? "active" : ""}`, onClick: () => setFilter("wins"), type: "button", children: ["Wins (", stats.wins, ")"] }), _jsxs("button", { className: `filter-btn ${filter === "losses" ? "active" : ""}`, onClick: () => setFilter("losses"), type: "button", children: ["Losses (", stats.losses, ")"] })] }), _jsx("input", { type: "search", placeholder: "Buscar por s\u00EDmbolo...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "search-input" })] }), _jsx("div", { className: "table-wrapper", children: _jsxs("table", { className: "enhanced-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Ativo" }), _jsx("th", { children: "Lado" }), _jsx("th", { children: "Entrada" }), _jsx("th", { children: "Sa\u00EDda" }), _jsxs("th", { className: "sortable", onClick: () => handleSort("exitTime"), children: ["Data Sa\u00EDda ", sortField === "exitTime" && (sortOrder === "asc" ? "↑" : "↓")] }), _jsx("th", { children: "Dura\u00E7\u00E3o" }), _jsxs("th", { className: "sortable", onClick: () => handleSort("pnl"), children: ["P&L ", sortField === "pnl" && (sortOrder === "asc" ? "↑" : "↓")] }), _jsxs("th", { className: "sortable", onClick: () => handleSort("pnlPercent"), children: ["P&L % ", sortField === "pnlPercent" && (sortOrder === "asc" ? "↑" : "↓")] })] }) }), _jsx("tbody", { children: filteredAndSortedTrades.map((trade, index) => {
                                const duration = formatDuration(trade.exitTime - trade.entryTime);
                                const pnlClass = trade.pnl >= 0 ? "positive" : "negative";
                                return (_jsxs(motion.tr, { initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, transition: { delay: index * 0.03, duration: 0.3 }, children: [_jsx("td", { className: "symbol-cell", children: trade.symbol }), _jsx("td", { children: _jsx("span", { className: `badge ${trade.side.toLowerCase()}`, children: trade.side }) }), _jsx("td", { children: formatCurrency(trade.entryPrice) }), _jsx("td", { children: formatCurrency(trade.exitPrice) }), _jsx("td", { children: new Date(trade.exitTime).toLocaleString("pt-BR") }), _jsx("td", { children: duration }), _jsx("td", { className: pnlClass, children: _jsx("strong", { children: formatCurrency(trade.pnl) }) }), _jsx("td", { className: pnlClass, children: _jsx("strong", { children: formatPercent(trade.pnlPercent) }) })] }, trade.id));
                            }) })] }) })] }));
}
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0)
        return `${days}d ${hours % 24}h`;
    if (hours > 0)
        return `${hours}h ${minutes % 60}m`;
    if (minutes > 0)
        return `${minutes}m`;
    return `${seconds}s`;
}
