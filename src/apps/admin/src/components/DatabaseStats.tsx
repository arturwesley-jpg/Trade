import React from "react";
import type { DatabaseStats } from "../types/admin";

interface DatabaseStatsProps {
  stats: DatabaseStats[];
}

export function DatabaseStatsTable({ stats }: DatabaseStatsProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const totalSize = stats.reduce((sum, stat) => sum + stat.sizeBytes, 0);
  const totalRows = stats.reduce((sum, stat) => sum + stat.rowCount, 0);

  return (
    <div className="admin-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "600" }}>Database Statistics</h2>
        <div style={{ display: "flex", gap: "2rem", fontSize: "0.875rem" }}>
          <div>
            <span style={{ color: "var(--text-secondary)" }}>Total Size: </span>
            <span style={{ fontWeight: "600" }}>{formatBytes(totalSize)}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-secondary)" }}>Total Rows: </span>
            <span style={{ fontWeight: "600" }}>{totalRows.toLocaleString()}</span>
          </div>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Table Name</th>
              <th>Row Count</th>
              <th>Table Size</th>
              <th>Index Size</th>
              <th>Total Size</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr key={stat.tableName}>
                <td style={{ fontWeight: "600" }}>{stat.tableName}</td>
                <td>{stat.rowCount.toLocaleString()}</td>
                <td>{formatBytes(stat.sizeBytes)}</td>
                <td>{formatBytes(stat.indexSize)}</td>
                <td style={{ fontWeight: "600" }}>{formatBytes(stat.sizeBytes + stat.indexSize)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
