import React from "react";
import { adminApi } from "../services/api";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
}

export function MetricCard({ title, value, change, trend, icon }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>
            {title}
          </p>
          <h3 style={{ fontSize: "1.875rem", fontWeight: "700", marginBottom: "0.25rem" }}>
            {value}
          </h3>
          {change && (
            <p
              style={{
                fontSize: "0.75rem",
                color:
                  trend === "up"
                    ? "var(--success)"
                    : trend === "down"
                    ? "var(--error)"
                    : "var(--text-secondary)",
              }}
            >
              {change}
            </p>
          )}
        </div>
        {icon && <div style={{ fontSize: "2rem", opacity: 0.5 }}>{icon}</div>}
      </div>
    </div>
  );
}

interface StatsOverviewProps {
  stats: Awaited<ReturnType<typeof adminApi.getStats>>;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>
      <MetricCard
        title="Total Users"
        value={stats.totalUsers.toLocaleString()}
        change={`${stats.activeUsers} active`}
        trend="neutral"
      />
      <MetricCard
        title="Total Trades"
        value={stats.totalTrades.toLocaleString()}
        change={`$${(stats.totalVolume / 1000).toFixed(1)}K volume`}
        trend="up"
      />
      <MetricCard
        title="Active Alerts"
        value={stats.activeAlerts.toLocaleString()}
        change={`${stats.totalAlerts} total`}
        trend="neutral"
      />
      <MetricCard
        title="API Requests (24h)"
        value={stats.apiRequests24h.toLocaleString()}
        change={`${stats.errorRate.toFixed(2)}% error rate`}
        trend={stats.errorRate > 5 ? "down" : "up"}
      />
      <MetricCard
        title="Avg Response Time"
        value={`${stats.avgResponseTime.toFixed(0)}ms`}
        trend={stats.avgResponseTime < 100 ? "up" : stats.avgResponseTime > 500 ? "down" : "neutral"}
      />
      <MetricCard
        title="System Uptime"
        value={formatUptime(stats.uptime)}
        change={`DB: ${stats.databaseSize}`}
        trend="up"
      />
    </div>
  );
}
