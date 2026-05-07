import React, { useState } from "react";
import type { UserListItem } from "../types/admin";

interface UsersTableProps {
  users: UserListItem[];
  onSuspend: (userId: string) => void;
  onActivate: (userId: string) => void;
  onDelete: (userId: string) => void;
  onViewDetails: (userId: string) => void;
}

export function UsersTable({ users, onSuspend, onActivate, onDelete, onViewDetails }: UsersTableProps) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="admin-card">
      <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1.5rem" }}>Users</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Trades</th>
              <th>Volume</th>
              <th>Last Login</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <button
                    onClick={() => onViewDetails(user.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent-primary)",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    {user.email}
                  </button>
                </td>
                <td>{user.name || "-"}</td>
                <td>
                  <span
                    className={`badge ${
                      user.role === "admin"
                        ? "badge-error"
                        : user.role === "viewer"
                        ? "badge-info"
                        : "badge-success"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td>
                  <span className={`badge ${user.isActive ? "badge-success" : "badge-warning"}`}>
                    {user.isActive ? "Active" : "Suspended"}
                  </span>
                </td>
                <td>{user.totalTrades}</td>
                <td>${user.totalVolume.toLocaleString()}</td>
                <td>{user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}</td>
                <td>{formatDate(user.createdAt)}</td>
                <td>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {user.isActive ? (
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          if (confirm(`Suspend user ${user.email}?`)) {
                            const reason = prompt("Reason for suspension:");
                            if (reason) onSuspend(user.id);
                          }
                        }}
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                      >
                        Suspend
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => onActivate(user.id)}
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                      >
                        Activate
                      </button>
                    )}
                    <button
                      className="btn btn-danger"
                      onClick={() => {
                        if (confirm(`Delete user ${user.email}? This action cannot be undone.`)) {
                          onDelete(user.id);
                        }
                      }}
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
