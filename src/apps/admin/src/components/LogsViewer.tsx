import React from "react";
import type { SystemLog } from "../types/admin";

interface LogsViewerProps {
  logs: SystemLog[];
}

export function LogsViewer({ logs }: LogsViewerProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      month: "short",
      day: "numeric",
    });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "var(--error)";
      case "warn":
        return "var(--warning)";
      default:
        return "var(--text-secondary)";
    }
  };

  return (
    <div className="admin-card">
      <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1.5rem" }}>System Logs</h2>
      <div
        style={{
          maxHeight: "500px",
          overflowY: "auto",
          fontFamily: "monospace",
          fontSize: "0.875rem",
        }}
      >
        {logs.map((log) => (
          <div
            key={log.id}
            style={{
              padding: "0.75rem",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              gap: "1rem",
            }}
          >
            <span style={{ color: "var(--text-secondary)", minWidth: "120px" }}>
              {formatDate(log.timestamp)}
            </span>
            <span
              style={{
                color: getLevelColor(log.level),
                fontWeight: "600",
                minWidth: "60px",
                textTransform: "uppercase",
              }}
            >
              {log.level}
            </span>
            <span style={{ color: "var(--accent-primary)", minWidth: "100px" }}>[{log.service}]</span>
            <span style={{ flex: 1 }}>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
