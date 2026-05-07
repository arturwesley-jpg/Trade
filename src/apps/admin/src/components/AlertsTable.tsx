import React from "react";
import type { AdminAlert } from "../types/admin";

interface AlertsTableProps {
  alerts: AdminAlert[];
}

export function AlertsTable({ alerts }: AlertsTableProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="admin-card">
      <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1.5rem" }}>Recent Alerts</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Name</th>
              <th>Type</th>
              <th>Symbol</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Triggers</th>
              <th>Last Triggered</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id}>
                <td>{alert.userEmail}</td>
                <td>{alert.name}</td>
                <td>
                  <span className="badge badge-info">{alert.type}</span>
                </td>
                <td>{alert.symbol || "-"}</td>
                <td>
                  <span
                    className={`badge ${
                      alert.status === "active"
                        ? "badge-success"
                        : alert.status === "triggered"
                        ? "badge-warning"
                        : "badge-info"
                    }`}
                  >
                    {alert.status}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${
                      alert.priority === "high"
                        ? "badge-error"
                        : alert.priority === "medium"
                        ? "badge-warning"
                        : "badge-info"
                    }`}
                  >
                    {alert.priority}
                  </span>
                </td>
                <td>{alert.triggerCount}</td>
                <td>{alert.lastTriggeredAt ? formatDate(alert.lastTriggeredAt) : "Never"}</td>
                <td>{formatDate(alert.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
