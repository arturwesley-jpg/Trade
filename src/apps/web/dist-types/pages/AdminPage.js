import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from "react";
import { ProviderStatus } from "../components/admin/ProviderStatus.js";
import { PaperMetrics } from "../components/admin/PaperMetrics.js";
import { AlertManagement } from "../components/admin/AlertManagement.js";
import { AuditLogs } from "../components/admin/AuditLogs.js";
import { SystemHealth } from "../components/admin/SystemHealth.js";
import { apiBaseUrl } from "../api.js";
export function AdminPage() {
    const [activeTab, setActiveTab] = useState("providers");
    const [providers, setProviders] = useState([]);
    const [consensus, setConsensus] = useState([]);
    const [paperMetrics, setPaperMetrics] = useState(null);
    const [recentTrades, setRecentTrades] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [systemHealth, setSystemHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const fetchProviderData = useCallback(async () => {
        try {
            const response = await fetch(`${apiBaseUrl}/admin/providers`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("accessToken")}`
                }
            });
            if (!response.ok)
                throw new Error("Failed to fetch provider data");
            const data = await response.json();
            setProviders(data.data.providers || []);
            setConsensus(data.data.consensus || []);
        }
        catch (err) {
            console.error("Error fetching provider data:", err);
        }
    }, []);
    const fetchPaperMetrics = useCallback(async () => {
        try {
            const response = await fetch(`${apiBaseUrl}/admin/paper-metrics`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("accessToken")}`
                }
            });
            if (!response.ok)
                throw new Error("Failed to fetch paper metrics");
            const data = await response.json();
            setPaperMetrics(data.data.metrics || null);
            setRecentTrades(data.data.recentTrades || []);
        }
        catch (err) {
            console.error("Error fetching paper metrics:", err);
        }
    }, []);
    const fetchAlerts = useCallback(async () => {
        try {
            const response = await fetch(`${apiBaseUrl}/alerts`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("accessToken")}`
                }
            });
            if (!response.ok)
                throw new Error("Failed to fetch alerts");
            const data = await response.json();
            setAlerts(data.data || []);
        }
        catch (err) {
            console.error("Error fetching alerts:", err);
        }
    }, []);
    const fetchAuditLogs = useCallback(async () => {
        try {
            const response = await fetch(`${apiBaseUrl}/admin/audit-logs`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("accessToken")}`
                }
            });
            if (!response.ok)
                throw new Error("Failed to fetch audit logs");
            const data = await response.json();
            setAuditLogs(data.data || []);
        }
        catch (err) {
            console.error("Error fetching audit logs:", err);
        }
    }, []);
    const fetchSystemHealth = useCallback(async () => {
        try {
            const response = await fetch(`${apiBaseUrl}/admin/health`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("accessToken")}`
                }
            });
            if (!response.ok)
                throw new Error("Failed to fetch system health");
            const data = await response.json();
            setSystemHealth(data.data || null);
        }
        catch (err) {
            console.error("Error fetching system health:", err);
        }
    }, []);
    const fetchAllData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await Promise.all([
                fetchProviderData(),
                fetchPaperMetrics(),
                fetchAlerts(),
                fetchAuditLogs(),
                fetchSystemHealth()
            ]);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load admin data");
        }
        finally {
            setLoading(false);
        }
    }, [fetchProviderData, fetchPaperMetrics, fetchAlerts, fetchAuditLogs, fetchSystemHealth]);
    useEffect(() => {
        void fetchAllData();
    }, [fetchAllData]);
    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            void fetchAllData();
        }, 30000);
        return () => clearInterval(interval);
    }, [fetchAllData]);
    const handleAcknowledgeAlert = async (alertId) => {
        try {
            const response = await fetch(`${apiBaseUrl}/admin/alerts/${alertId}/acknowledge`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("accessToken")}`
                }
            });
            if (!response.ok)
                throw new Error("Failed to acknowledge alert");
            await fetchAlerts();
        }
        catch (err) {
            console.error("Error acknowledging alert:", err);
        }
    };
    const handleResolveAlert = async (alertId) => {
        try {
            const response = await fetch(`${apiBaseUrl}/admin/alerts/${alertId}/resolve`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("accessToken")}`
                }
            });
            if (!response.ok)
                throw new Error("Failed to resolve alert");
            await fetchAlerts();
        }
        catch (err) {
            console.error("Error resolving alert:", err);
        }
    };
    const handleCreateAlert = async (alert) => {
        try {
            const response = await fetch(`${apiBaseUrl}/admin/alerts`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("accessToken")}`
                },
                body: JSON.stringify(alert)
            });
            if (!response.ok)
                throw new Error("Failed to create alert");
            await fetchAlerts();
        }
        catch (err) {
            console.error("Error creating alert:", err);
        }
    };
    if (loading) {
        return (_jsx("div", { className: "admin-page", children: _jsx("div", { className: "admin-loading", children: "Loading admin panel..." }) }));
    }
    if (error) {
        return (_jsx("div", { className: "admin-page", children: _jsxs("div", { className: "admin-error", children: [_jsx("h2", { children: "Error Loading Admin Panel" }), _jsx("p", { children: error }), _jsx("button", { onClick: () => void fetchAllData(), className: "btn-primary", children: "Retry" })] }) }));
    }
    return (_jsxs("div", { className: "admin-page", children: [_jsxs("header", { className: "admin-header", children: [_jsxs("div", { children: [_jsx("h1", { children: "Admin Dashboard" }), _jsx("p", { children: "System monitoring and management" })] }), _jsx("button", { onClick: () => void fetchAllData(), className: "btn-secondary", children: "Refresh All" })] }), _jsxs("nav", { className: "admin-tabs", children: [_jsx("button", { className: activeTab === "providers" ? "active" : "", onClick: () => setActiveTab("providers"), children: "Provider Status" }), _jsx("button", { className: activeTab === "metrics" ? "active" : "", onClick: () => setActiveTab("metrics"), children: "Paper Metrics" }), _jsxs("button", { className: activeTab === "alerts" ? "active" : "", onClick: () => setActiveTab("alerts"), children: ["Alerts", alerts.filter((a) => a.status === "OPEN").length > 0 && (_jsx("span", { className: "badge", children: alerts.filter((a) => a.status === "OPEN").length }))] }), _jsx("button", { className: activeTab === "audit" ? "active" : "", onClick: () => setActiveTab("audit"), children: "Audit Logs" }), _jsx("button", { className: activeTab === "health" ? "active" : "", onClick: () => setActiveTab("health"), children: "System Health" })] }), _jsxs("div", { className: "admin-content", children: [activeTab === "providers" && (_jsx(ProviderStatus, { providers: providers, consensus: consensus, onRefresh: fetchProviderData })), activeTab === "metrics" && paperMetrics && (_jsx(PaperMetrics, { metrics: paperMetrics, recentTrades: recentTrades })), activeTab === "alerts" && (_jsx(AlertManagement, { alerts: alerts, onAcknowledge: handleAcknowledgeAlert, onResolve: handleResolveAlert, onCreate: handleCreateAlert })), activeTab === "audit" && (_jsx(AuditLogs, { logs: auditLogs, onRefresh: fetchAuditLogs })), activeTab === "health" && systemHealth && (_jsx(SystemHealth, { health: systemHealth, onRefresh: fetchSystemHealth }))] })] }));
}
