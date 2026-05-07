import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
export function ProviderStatus({ providers, consensus, onRefresh }) {
    const [autoRefresh, setAutoRefresh] = useState(true);
    useEffect(() => {
        if (!autoRefresh || !onRefresh)
            return;
        const interval = setInterval(onRefresh, 10000);
        return () => clearInterval(interval);
    }, [autoRefresh, onRefresh]);
    const healthyCount = providers.filter((p) => p.status === "healthy").length;
    const avgLatency = providers.reduce((sum, p) => sum + p.latencyMs, 0) / providers.length;
    const avgQuality = providers.reduce((sum, p) => sum + p.dataQuality, 0) / providers.length;
    return (_jsxs("div", { className: "admin-section", children: [_jsxs("div", { className: "admin-section-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Provider Status Dashboard" }), _jsx("p", { children: "Real-time monitoring of all market data providers" })] }), _jsxs("div", { className: "admin-actions", children: [_jsxs("label", { className: "toggle-label", children: [_jsx("input", { type: "checkbox", checked: autoRefresh, onChange: (e) => setAutoRefresh(e.target.checked) }), "Auto-refresh (10s)"] }), onRefresh && (_jsx("button", { onClick: onRefresh, className: "btn-secondary", children: "Refresh Now" }))] })] }), _jsxs("div", { className: "stats-grid", children: [_jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-label", children: "Healthy Providers" }), _jsxs("strong", { className: "stat-value", children: [healthyCount, "/", providers.length] })] }), _jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-label", children: "Avg Latency" }), _jsxs("strong", { className: "stat-value", children: [avgLatency.toFixed(0), "ms"] })] }), _jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-label", children: "Avg Quality" }), _jsxs("strong", { className: "stat-value", children: [avgQuality.toFixed(1), "%"] })] })] }), _jsx("div", { className: "provider-grid", children: providers.map((provider) => (_jsx(ProviderCard, { provider: provider }, provider.provider))) }), _jsxs("div", { className: "consensus-section", children: [_jsx("h3", { children: "Price Consensus View" }), consensus.map((item) => (_jsx(ConsensusCard, { consensus: item }, item.symbol)))] })] }));
}
function ProviderCard({ provider }) {
    const statusColor = {
        healthy: "#10b981",
        degraded: "#f59e0b",
        down: "#ef4444"
    }[provider.status];
    const statusIcon = {
        healthy: "●",
        degraded: "◐",
        down: "○"
    }[provider.status];
    return (_jsxs("div", { className: "provider-card", children: [_jsxs("div", { className: "provider-header", children: [_jsx("h4", { children: provider.provider.toUpperCase() }), _jsxs("span", { className: "status-indicator", style: { color: statusColor }, children: [statusIcon, " ", provider.status] })] }), _jsxs("div", { className: "provider-metrics", children: [_jsxs("div", { className: "metric", children: [_jsx("span", { children: "Latency" }), _jsxs("strong", { className: provider.latencyMs > 500 ? "text-warning" : "", children: [provider.latencyMs, "ms"] })] }), _jsxs("div", { className: "metric", children: [_jsx("span", { children: "Quality" }), _jsxs("strong", { children: [provider.dataQuality.toFixed(1), "%"] })] }), _jsxs("div", { className: "metric", children: [_jsx("span", { children: "Errors" }), _jsx("strong", { className: provider.errorCount > 0 ? "text-danger" : "", children: provider.errorCount })] })] }), provider.priceUsd && (_jsxs("div", { className: "provider-price", children: ["$", provider.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })), _jsx("div", { className: "provider-footer", children: _jsxs("small", { children: ["Last update: ", new Date(provider.lastUpdate).toLocaleTimeString()] }) })] }));
}
function ConsensusCard({ consensus }) {
    const hasDisagreement = consensus.disagreementPct > 0.5;
    return (_jsxs("div", { className: `consensus-card ${hasDisagreement ? "has-alert" : ""}`, children: [_jsxs("div", { className: "consensus-header", children: [_jsx("h4", { children: consensus.symbol }), _jsxs("div", { className: "consensus-price", children: ["$", consensus.consensusPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })] })] }), _jsxs("div", { className: "consensus-range", children: [_jsxs("span", { children: ["Range: $", consensus.priceRange.min.toFixed(2), " - $", consensus.priceRange.max.toFixed(2)] }), hasDisagreement && (_jsxs("span", { className: "disagreement-alert", children: ["\u26A0 ", consensus.disagreementPct.toFixed(2), "% disagreement"] }))] }), _jsx("div", { className: "provider-prices", children: consensus.providers.map((p) => (_jsxs("div", { className: "provider-price-item", children: [_jsx("span", { children: p.name }), _jsxs("strong", { children: ["$", p.price.toFixed(2)] })] }, p.name))) })] }));
}
