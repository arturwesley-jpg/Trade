import React from "react";
import type { AdminTrade } from "../types/admin";

interface TradesTableProps {
  trades: AdminTrade[];
}

export function TradesTable({ trades }: TradesTableProps) {
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
      <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1.5rem" }}>Recent Trades</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Symbol</th>
              <th>Side</th>
              <th>Mode</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>PnL</th>
              <th>Margin</th>
              <th>Status</th>
              <th>Opened</th>
              <th>Closed</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id}>
                <td>{trade.userEmail}</td>
                <td style={{ fontWeight: "600" }}>{trade.symbol}</td>
                <td>
                  <span className={`badge ${trade.side === "LONG" ? "badge-success" : "badge-error"}`}>
                    {trade.side}
                  </span>
                </td>
                <td>
                  <span className="badge badge-info">{trade.mode}</span>
                </td>
                <td>${trade.entryPrice.toLocaleString()}</td>
                <td>{trade.exitPrice ? `$${trade.exitPrice.toLocaleString()}` : "-"}</td>
                <td
                  style={{
                    color: trade.pnlUsdt >= 0 ? "var(--success)" : "var(--error)",
                    fontWeight: "600",
                  }}
                >
                  ${trade.pnlUsdt.toFixed(2)}
                </td>
                <td>${trade.marginUsdt.toFixed(2)}</td>
                <td>
                  <span className={`badge ${trade.status === "OPEN" ? "badge-warning" : "badge-success"}`}>
                    {trade.status}
                  </span>
                </td>
                <td>{formatDate(trade.openedAt)}</td>
                <td>{trade.closedAt ? formatDate(trade.closedAt) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
