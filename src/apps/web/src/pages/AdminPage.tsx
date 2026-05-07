import { useState, useEffect, useCallback } from "react";
import { ProviderStatus, type ProviderHealth, type PriceConsensus } from "../components/admin/ProviderStatus.js";
import { PaperMetrics, type PaperMetrics as PaperMetricsType } from "../components/admin/PaperMetrics.js";
import { AlertManagement, type CreateAlertRequest } from "../components/admin/AlertManagement.js";
import { AuditLogs, type AuditLog } from "../components/admin/AuditLogs.js";
import { SystemHealth, type SystemHealthData } from "../components/admin/SystemHealth.js";
import type { AlertEvent, Position } from "../shared-types.js";
import { apiBaseUrl } from "../api.js";

type AdminTab = "providers" | "metrics" | "alerts" | "audit" | "health";

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("providers");
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [consensus, setConsensus] = useState<PriceConsensus[]>([]);
  const [paperMetrics, setPaperMetrics] = useState<PaperMetricsType | null>(null);
  const [recentTrades, setRecentTrades] = useState<Position[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviderData = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/providers`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch provider data");
      const data = await response.json();
      setProviders(data.data.providers || []);
      setConsensus(data.data.consensus || []);
    } catch (err) {
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
      if (!response.ok) throw new Error("Failed to fetch paper metrics");
      const data = await response.json();
      setPaperMetrics(data.data.metrics || null);
      setRecentTrades(data.data.recentTrades || []);
    } catch (err) {
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
      if (!response.ok) throw new Error("Failed to fetch alerts");
      const data = await response.json();
      setAlerts(data.data || []);
    } catch (err) {
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
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      const data = await response.json();
      setAuditLogs(data.data || []);
    } catch (err) {
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
      if (!response.ok) throw new Error("Failed to fetch system health");
      const data = await response.json();
      setSystemHealth(data.data || null);
    } catch (err) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
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

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/alerts/${alertId}/acknowledge`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`
        }
      });
      if (!response.ok) throw new Error("Failed to acknowledge alert");
      await fetchAlerts();
    } catch (err) {
      console.error("Error acknowledging alert:", err);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/alerts/${alertId}/resolve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`
        }
      });
      if (!response.ok) throw new Error("Failed to resolve alert");
      await fetchAlerts();
    } catch (err) {
      console.error("Error resolving alert:", err);
    }
  };

  const handleCreateAlert = async (alert: CreateAlertRequest) => {
    try {
      const response = await fetch(`${apiBaseUrl}/admin/alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`
        },
        body: JSON.stringify(alert)
      });
      if (!response.ok) throw new Error("Failed to create alert");
      await fetchAlerts();
    } catch (err) {
      console.error("Error creating alert:", err);
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">Loading admin panel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="admin-error">
          <h2>Error Loading Admin Panel</h2>
          <p>{error}</p>
          <button onClick={() => void fetchAllData()} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>System monitoring and management</p>
        </div>
        <button onClick={() => void fetchAllData()} className="btn-secondary">
          Refresh All
        </button>
      </header>

      <nav className="admin-tabs">
        <button
          className={activeTab === "providers" ? "active" : ""}
          onClick={() => setActiveTab("providers")}
        >
          Provider Status
        </button>
        <button
          className={activeTab === "metrics" ? "active" : ""}
          onClick={() => setActiveTab("metrics")}
        >
          Paper Metrics
        </button>
        <button
          className={activeTab === "alerts" ? "active" : ""}
          onClick={() => setActiveTab("alerts")}
        >
          Alerts
          {alerts.filter((a) => a.status === "OPEN").length > 0 && (
            <span className="badge">{alerts.filter((a) => a.status === "OPEN").length}</span>
          )}
        </button>
        <button
          className={activeTab === "audit" ? "active" : ""}
          onClick={() => setActiveTab("audit")}
        >
          Audit Logs
        </button>
        <button
          className={activeTab === "health" ? "active" : ""}
          onClick={() => setActiveTab("health")}
        >
          System Health
        </button>
      </nav>

      <div className="admin-content">
        {activeTab === "providers" && (
          <ProviderStatus
            providers={providers}
            consensus={consensus}
            onRefresh={fetchProviderData}
          />
        )}

        {activeTab === "metrics" && paperMetrics && (
          <PaperMetrics metrics={paperMetrics} recentTrades={recentTrades} />
        )}

        {activeTab === "alerts" && (
          <AlertManagement
            alerts={alerts}
            onAcknowledge={handleAcknowledgeAlert}
            onResolve={handleResolveAlert}
            onCreate={handleCreateAlert}
          />
        )}

        {activeTab === "audit" && (
          <AuditLogs logs={auditLogs} onRefresh={fetchAuditLogs} />
        )}

        {activeTab === "health" && systemHealth && (
          <SystemHealth health={systemHealth} onRefresh={fetchSystemHealth} />
        )}
      </div>
    </div>
  );
}
