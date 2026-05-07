import { useEffect, useState } from "react";

export interface SystemHealthData {
  api: {
    status: "healthy" | "degraded" | "down";
    responseTime: number;
    uptime: number;
  };
  database: {
    status: "connected" | "disconnected" | "error";
    connectionPool: {
      active: number;
      idle: number;
      total: number;
    };
    queryTime: number;
  };
  redis: {
    status: "connected" | "disconnected" | "error";
    memoryUsed: number;
    memoryTotal: number;
    hitRate: number;
  };
  worker: {
    status: "running" | "stopped" | "error";
    jobsProcessed: number;
    jobsFailed: number;
    queueSize: number;
  };
  system?: {
    memoryUsage: number;
    memoryTotal: number;
    cpuUsage: number;
    uptime: number;
  };
}

interface SystemHealthProps {
  health: SystemHealthData;
  onRefresh?: () => void;
}

export function SystemHealth({ health, onRefresh }: SystemHealthProps) {
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh || !onRefresh) return;
    const interval = setInterval(onRefresh, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  const overallStatus = getOverallStatus(health);

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div>
          <h2>System Health</h2>
          <p>Real-time system status and resource monitoring</p>
        </div>
        <div className="admin-actions">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (5s)
          </label>
          {onRefresh && (
            <button onClick={onRefresh} className="btn-secondary">
              Refresh Now
            </button>
          )}
        </div>
      </div>

      <div className="health-overview">
        <div className={`overall-status status-${overallStatus}`}>
          <span className="status-icon">{getStatusIcon(overallStatus)}</span>
          <div>
            <h3>Overall Status</h3>
            <strong>{overallStatus.toUpperCase()}</strong>
          </div>
        </div>
      </div>

      <div className="health-grid">
        <HealthCard
          title="API Server"
          status={health.api.status}
          metrics={[
            { label: "Response Time", value: `${health.api.responseTime}ms` },
            { label: "Uptime", value: formatUptime(health.api.uptime) }
          ]}
        />

        <HealthCard
          title="Database"
          status={health.database.status === "connected" ? "healthy" : health.database.status === "disconnected" ? "down" : "degraded"}
          metrics={[
            { label: "Active Connections", value: `${health.database.connectionPool.active}/${health.database.connectionPool.total}` },
            { label: "Idle Connections", value: String(health.database.connectionPool.idle) },
            { label: "Query Time", value: `${health.database.queryTime}ms` }
          ]}
        />

        <HealthCard
          title="Redis Cache"
          status={health.redis.status === "connected" ? "healthy" : health.redis.status === "disconnected" ? "down" : "degraded"}
          metrics={[
            { label: "Memory Used", value: `${(health.redis.memoryUsed / 1024 / 1024).toFixed(1)} MB` },
            { label: "Hit Rate", value: `${health.redis.hitRate.toFixed(1)}%` }
          ]}
        >
          <ProgressBar
            label="Memory"
            value={health.redis.memoryUsed}
            max={health.redis.memoryTotal}
            unit="MB"
          />
        </HealthCard>

        <HealthCard
          title="Worker Queue"
          status={health.worker.status === "running" ? "healthy" : health.worker.status === "stopped" ? "down" : "degraded"}
          metrics={[
            { label: "Jobs Processed", value: String(health.worker.jobsProcessed) },
            { label: "Jobs Failed", value: String(health.worker.jobsFailed) },
            { label: "Queue Size", value: String(health.worker.queueSize) }
          ]}
        />
      </div>

      {health.system && (
        <div className="system-resources">
          <h3>System Resources</h3>
          <div className="resource-grid">
            <div className="resource-card">
              <ProgressBar
                label="Memory Usage"
                value={health.system.memoryUsage}
                max={health.system.memoryTotal}
                unit="GB"
              />
            </div>
            <div className="resource-card">
              <ProgressBar
                label="CPU Usage"
                value={health.system.cpuUsage}
                max={100}
                unit="%"
              />
            </div>
            <div className="resource-card">
              <div className="metric">
                <span>System Uptime</span>
                <strong>{formatUptime(health.system.uptime)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HealthCard({
  title,
  status,
  metrics,
  children
}: {
  title: string;
  status: "healthy" | "degraded" | "down";
  metrics: Array<{ label: string; value: string }>;
  children?: React.ReactNode;
}) {
  const statusColor = {
    healthy: "#10b981",
    degraded: "#f59e0b",
    down: "#ef4444"
  }[status];

  return (
    <div className="health-card">
      <div className="health-card-header">
        <h4>{title}</h4>
        <span className="status-indicator" style={{ color: statusColor }}>
          {getStatusIcon(status)} {status}
        </span>
      </div>
      <div className="health-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="metric">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

function ProgressBar({
  label,
  value,
  max,
  unit
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
}) {
  const percentage = (value / max) * 100;
  const isWarning = percentage > 80;
  const isDanger = percentage > 90;

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-header">
        <span>{label}</span>
        <strong>
          {unit === "MB" || unit === "GB" ? (value / (unit === "GB" ? 1024 : 1)).toFixed(1) : value.toFixed(1)} {unit} / {unit === "MB" || unit === "GB" ? (max / (unit === "GB" ? 1024 : 1)).toFixed(1) : max} {unit}
        </strong>
      </div>
      <div className="progress-bar">
        <div
          className={`progress-bar-fill ${isDanger ? "danger" : isWarning ? "warning" : ""}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

function getOverallStatus(health: SystemHealthData): "healthy" | "degraded" | "down" {
  const statuses = [
    health.api.status,
    health.database.status === "connected" ? "healthy" : "down",
    health.redis.status === "connected" ? "healthy" : "down",
    health.worker.status === "running" ? "healthy" : "down"
  ];

  if (statuses.some((s) => s === "down")) return "down";
  if (statuses.some((s) => s === "degraded")) return "degraded";
  return "healthy";
}

function getStatusIcon(status: string): string {
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

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
