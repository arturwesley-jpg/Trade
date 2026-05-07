import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
export function SystemHealth({ health, onRefresh }) {
    const [autoRefresh, setAutoRefresh] = useState(true);
    useEffect(() => {
        if (!autoRefresh || !onRefresh)
            return;
        const interval = setInterval(onRefresh, 5000);
        return () => clearInterval(interval);
    }, [autoRefresh, onRefresh]);
    const overallStatus = getOverallStatus(health);
    return (_jsxs("div", { className: "admin-section", children: [_jsxs("div", { className: "admin-section-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "System Health" }), _jsx("p", { children: "Real-time system status and resource monitoring" })] }), _jsxs("div", { className: "admin-actions", children: [_jsxs("label", { className: "toggle-label", children: [_jsx("input", { type: "checkbox", checked: autoRefresh, onChange: (e) => setAutoRefresh(e.target.checked) }), "Auto-refresh (5s)"] }), onRefresh && (_jsx("button", { onClick: onRefresh, className: "btn-secondary", children: "Refresh Now" }))] })] }), _jsx("div", { className: "health-overview", children: _jsxs("div", { className: `overall-status status-${overallStatus}`, children: [_jsx("span", { className: "status-icon", children: getStatusIcon(overallStatus) }), _jsxs("div", { children: [_jsx("h3", { children: "Overall Status" }), _jsx("strong", { children: overallStatus.toUpperCase() })] })] }) }), _jsxs("div", { className: "health-grid", children: [_jsx(HealthCard, { title: "API Server", status: health.api.status, metrics: [
                            { label: "Response Time", value: `${health.api.responseTime}ms` },
                            { label: "Uptime", value: formatUptime(health.api.uptime) }
                        ] }), _jsx(HealthCard, { title: "Database", status: health.database.status === "connected" ? "healthy" : health.database.status === "disconnected" ? "down" : "degraded", metrics: [
                            { label: "Active Connections", value: `${health.database.connectionPool.active}/${health.database.connectionPool.total}` },
                            { label: "Idle Connections", value: String(health.database.connectionPool.idle) },
                            { label: "Query Time", value: `${health.database.queryTime}ms` }
                        ] }), _jsx(HealthCard, { title: "Redis Cache", status: health.redis.status === "connected" ? "healthy" : health.redis.status === "disconnected" ? "down" : "degraded", metrics: [
                            { label: "Memory Used", value: `${(health.redis.memoryUsed / 1024 / 1024).toFixed(1)} MB` },
                            { label: "Hit Rate", value: `${health.redis.hitRate.toFixed(1)}%` }
                        ], children: _jsx(ProgressBar, { label: "Memory", value: health.redis.memoryUsed, max: health.redis.memoryTotal, unit: "MB" }) }), _jsx(HealthCard, { title: "Worker Queue", status: health.worker.status === "running" ? "healthy" : health.worker.status === "stopped" ? "down" : "degraded", metrics: [
                            { label: "Jobs Processed", value: String(health.worker.jobsProcessed) },
                            { label: "Jobs Failed", value: String(health.worker.jobsFailed) },
                            { label: "Queue Size", value: String(health.worker.queueSize) }
                        ] })] }), health.system && (_jsxs("div", { className: "system-resources", children: [_jsx("h3", { children: "System Resources" }), _jsxs("div", { className: "resource-grid", children: [_jsx("div", { className: "resource-card", children: _jsx(ProgressBar, { label: "Memory Usage", value: health.system.memoryUsage, max: health.system.memoryTotal, unit: "GB" }) }), _jsx("div", { className: "resource-card", children: _jsx(ProgressBar, { label: "CPU Usage", value: health.system.cpuUsage, max: 100, unit: "%" }) }), _jsx("div", { className: "resource-card", children: _jsxs("div", { className: "metric", children: [_jsx("span", { children: "System Uptime" }), _jsx("strong", { children: formatUptime(health.system.uptime) })] }) })] })] }))] }));
}
function HealthCard({ title, status, metrics, children }) {
    const statusColor = {
        healthy: "#10b981",
        degraded: "#f59e0b",
        down: "#ef4444"
    }[status];
    return (_jsxs("div", { className: "health-card", children: [_jsxs("div", { className: "health-card-header", children: [_jsx("h4", { children: title }), _jsxs("span", { className: "status-indicator", style: { color: statusColor }, children: [getStatusIcon(status), " ", status] })] }), _jsx("div", { className: "health-metrics", children: metrics.map((metric) => (_jsxs("div", { className: "metric", children: [_jsx("span", { children: metric.label }), _jsx("strong", { children: metric.value })] }, metric.label))) }), children] }));
}
function ProgressBar({ label, value, max, unit }) {
    const percentage = (value / max) * 100;
    const isWarning = percentage > 80;
    const isDanger = percentage > 90;
    return (_jsxs("div", { className: "progress-bar-container", children: [_jsxs("div", { className: "progress-bar-header", children: [_jsx("span", { children: label }), _jsxs("strong", { children: [unit === "MB" || unit === "GB" ? (value / (unit === "GB" ? 1024 : 1)).toFixed(1) : value.toFixed(1), " ", unit, " / ", unit === "MB" || unit === "GB" ? (max / (unit === "GB" ? 1024 : 1)).toFixed(1) : max, " ", unit] })] }), _jsx("div", { className: "progress-bar", children: _jsx("div", { className: `progress-bar-fill ${isDanger ? "danger" : isWarning ? "warning" : ""}`, style: { width: `${Math.min(percentage, 100)}%` } }) })] }));
}
function getOverallStatus(health) {
    const statuses = [
        health.api.status,
        health.database.status === "connected" ? "healthy" : "down",
        health.redis.status === "connected" ? "healthy" : "down",
        health.worker.status === "running" ? "healthy" : "down"
    ];
    if (statuses.some((s) => s === "down"))
        return "down";
    if (statuses.some((s) => s === "degraded"))
        return "degraded";
    return "healthy";
}
function getStatusIcon(status) {
    switch (status) {
        case "healthy":
        case "connected":
        case "running":
            return "●";
        case "degraded":
            return "◐";
        case "down":
        case "disconnected":
        case "stopped":
        case "error":
            return "○";
        default:
            return "?";
    }
}
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0)
        return `${days}d ${hours}h`;
    if (hours > 0)
        return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}
