import { useState } from "react";
import type { AlertEvent } from "../../shared-types.js";

interface AlertManagementProps {
  alerts: AlertEvent[];
  onAcknowledge: (alertId: string) => Promise<void>;
  onResolve: (alertId: string) => Promise<void>;
  onCreate?: (alert: CreateAlertRequest) => Promise<void>;
}

export interface CreateAlertRequest {
  type: AlertEvent["type"];
  title: string;
  message: string;
  severity: AlertEvent["severity"];
}

export function AlertManagement({ alerts, onAcknowledge, onResolve, onCreate }: AlertManagementProps) {
  const [filter, setFilter] = useState<"all" | AlertEvent["status"]>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | AlertEvent["severity"]>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const filteredAlerts = alerts.filter((alert) => {
    if (filter !== "all" && alert.status !== filter) return false;
    if (severityFilter !== "all" && alert.severity !== severityFilter) return false;
    return true;
  });

  const openAlerts = alerts.filter((a) => a.status === "OPEN").length;
  const ackedAlerts = alerts.filter((a) => a.status === "ACKED").length;
  const resolvedAlerts = alerts.filter((a) => a.status === "RESOLVED").length;

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div>
          <h2>Alert Management</h2>
          <p>Monitor and manage system alerts</p>
        </div>
        {onCreate && (
          <button onClick={() => setShowCreateForm(true)} className="btn-primary">
            Create Alert Rule
          </button>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Open Alerts</span>
          <strong className="stat-value text-danger">{openAlerts}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Acknowledged</span>
          <strong className="stat-value text-warning">{ackedAlerts}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Resolved</span>
          <strong className="stat-value text-success">{resolvedAlerts}</strong>
        </div>
      </div>

      <div className="alert-filters">
        <div className="filter-group">
          <label>Status:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="OPEN">Open</option>
            <option value="ACKED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Severity:</label>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div className="alerts-list">
        {filteredAlerts.length === 0 ? (
          <div className="empty-state">No alerts match the current filters</div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={onAcknowledge}
              onResolve={onResolve}
            />
          ))
        )}
      </div>

      {showCreateForm && onCreate && (
        <CreateAlertForm
          onSubmit={async (data) => {
            await onCreate(data);
            setShowCreateForm(false);
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}

function AlertCard({
  alert,
  onAcknowledge,
  onResolve
}: {
  alert: AlertEvent;
  onAcknowledge: (id: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  };

  const severityColor = {
    low: "var(--color-info, #3b82f6)",
    medium: "var(--color-warning, #f59e0b)",
    high: "var(--color-danger, #ef4444)"
  }[alert.severity];

  return (
    <div className="alert-card" style={{ borderLeftColor: severityColor }}>
      <div className="alert-card-header">
        <div>
          <span className={`alert-badge severity-${alert.severity}`}>{alert.severity.toUpperCase()}</span>
          <span className={`alert-badge status-${alert.status.toLowerCase()}`}>{alert.status}</span>
          <span className="alert-type">{alert.type}</span>
        </div>
        <div className="alert-actions">
          {alert.status === "OPEN" && (
            <button
              onClick={() => handleAction(() => onAcknowledge(alert.id))}
              disabled={loading}
              className="btn-secondary btn-sm"
            >
              Acknowledge
            </button>
          )}
          {alert.status !== "RESOLVED" && (
            <button
              onClick={() => handleAction(() => onResolve(alert.id))}
              disabled={loading}
              className="btn-primary btn-sm"
            >
              Resolve
            </button>
          )}
        </div>
      </div>
      <h3>{alert.title}</h3>
      <p>{alert.message}</p>
      <div className="alert-footer">
        <small>Created: {new Date(alert.createdAt).toLocaleString()}</small>
        {alert.resolvedAt && <small>Resolved: {new Date(alert.resolvedAt).toLocaleString()}</small>}
      </div>
    </div>
  );
}

function CreateAlertForm({
  onSubmit,
  onCancel
}: {
  onSubmit: (data: CreateAlertRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<CreateAlertRequest>({
    type: "TECHNICAL",
    title: "",
    message: "",
    severity: "medium"
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3>Create Alert Rule</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              required
            >
              <option value="PRICE">Price</option>
              <option value="TECHNICAL">Technical</option>
              <option value="WHALE">Whale</option>
              <option value="NEWS">News</option>
              <option value="SENTIMENT">Sentiment</option>
              <option value="RISK">Risk</option>
            </select>
          </div>
          <div className="form-group">
            <label>Severity</label>
            <select
              value={formData.severity}
              onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
              required
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Message</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={4}
              required
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creating..." : "Create Alert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
