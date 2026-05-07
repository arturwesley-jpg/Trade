import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import type { ApiUsageStats } from "../types/admin";

interface ApiUsageChartProps {
  data: ApiUsageStats[];
}

export function ApiUsageChart({ data }: ApiUsageChartProps) {
  const chartData = data.slice(0, 10).map((item) => ({
    endpoint: item.endpoint.length > 20 ? item.endpoint.substring(0, 20) + "..." : item.endpoint,
    count: item.count,
    avgTime: item.avgResponseTime,
    errorRate: item.errorRate,
  }));

  return (
    <div className="chart-container">
      <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1.5rem" }}>
        API Usage (Top 10 Endpoints)
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="endpoint" stroke="var(--text-secondary)" fontSize={12} />
          <YAxis stroke="var(--text-secondary)" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
            }}
          />
          <Bar dataKey="count" fill="var(--accent-primary)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TradingVolumeChartProps {
  data: Array<{ date: string; volume: number; trades: number }>;
}

export function TradingVolumeChart({ data }: TradingVolumeChartProps) {
  return (
    <div className="chart-container">
      <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1.5rem" }}>Trading Volume (7 Days)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} />
          <YAxis stroke="var(--text-secondary)" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-tertiary)",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
            }}
          />
          <Line type="monotone" dataKey="volume" stroke="var(--accent-primary)" strokeWidth={2} />
          <Line type="monotone" dataKey="trades" stroke="var(--accent-secondary)" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
