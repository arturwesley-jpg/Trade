/**
 * Alert Management Panel Component
 * Allows users to create, view, and manage price alerts
 */

import { memo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Alert {
  id: string;
  symbol: string;
  condition: "above" | "below";
  price: number;
  status: "active" | "triggered" | "snoozed";
  createdAt: string;
  triggeredAt?: string;
}

interface AlertManagementPanelProps {
  symbol?: string;
}

export const AlertManagementPanel = memo(function AlertManagementPanel({
  symbol = "BTCUSDT"
}: AlertManagementPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAlert, setNewAlert] = useState({
    symbol,
    condition: "above" as "above" | "below",
    price: ""
  });

  // Mock data for demonstration
  useEffect(() => {
    setAlerts([
      {
        id: "1",
        symbol: "BTCUSDT",
        condition: "above",
        price: 50000,
        status: "active",
        createdAt: new Date().toISOString()
      },
      {
        id: "2",
        symbol: "ETHUSDT",
        condition: "below",
        price: 3000,
        status: "active",
        createdAt: new Date().toISOString()
      }
    ]);
  }, []);

  const handleCreateAlert = () => {
    if (!newAlert.price) return;

    const alert: Alert = {
      id: Date.now().toString(),
      symbol: newAlert.symbol,
      condition: newAlert.condition,
      price: parseFloat(newAlert.price),
      status: "active",
      createdAt: new Date().toISOString()
    };

    setAlerts([...alerts, alert]);
    setShowCreateModal(false);
    setNewAlert({ symbol, condition: "above", price: "" });
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  const handleSnoozeAlert = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, status: "snoozed" as const } : a));
  };

  const getStatusColor = (status: Alert["status"]) => {
    switch (status) {
      case "active":
        return "var(--positive)";
      case "triggered":
        return "var(--warning)";
      case "snoozed":
        return "var(--muted)";
    }
  };

  return (
    <div className="alert-management-panel">
      <div className="panel-header">
        <h3>Price Alerts</h3>
        <button
          className="create-alert-btn"
          onClick={() => setShowCreateModal(true)}
          aria-label="Create new alert"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Alert
        </button>
      </div>

      <div className="alerts-list">
        <AnimatePresence mode="popLayout">
          {alerts.map((alert, index) => (
            <motion.div
              key={alert.id}
              className="alert-item"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <div className="alert-info">
                <div className="alert-symbol">{alert.symbol}</div>
                <div className="alert-condition">
                  {alert.condition === "above" ? "↑" : "↓"} ${alert.price.toLocaleString()}
                </div>
                <div
                  className="alert-status"
                  style={{ color: getStatusColor(alert.status) }}
                >
                  {alert.status}
                </div>
              </div>

              <div className="alert-actions">
                {alert.status === "active" && (
                  <button
                    className="alert-action-btn snooze"
                    onClick={() => handleSnoozeAlert(alert.id)}
                    aria-label="Snooze alert"
                    title="Snooze"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                    </svg>
                  </button>
                )}
                <button
                  className="alert-action-btn delete"
                  onClick={() => handleDeleteAlert(alert.id)}
                  aria-label="Delete alert"
                  title="Delete"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {alerts.length === 0 && (
          <div className="empty-state">
            <p>No alerts configured</p>
          </div>
        )}
      </div>

      {/* Create Alert Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Create Price Alert</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowCreateModal(false)}
                  aria-label="Close modal"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="alert-symbol">Symbol</label>
                  <input
                    id="alert-symbol"
                    type="text"
                    value={newAlert.symbol}
                    onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value })}
                    className="form-input"
                    placeholder="BTCUSDT"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="alert-condition">Condition</label>
                  <select
                    id="alert-condition"
                    value={newAlert.condition}
                    onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value as "above" | "below" })}
                    className="form-input"
                  >
                    <option value="above">Price Above</option>
                    <option value="below">Price Below</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="alert-price">Price (USDT)</label>
                  <input
                    id="alert-price"
                    type="number"
                    step="0.01"
                    value={newAlert.price}
                    onChange={(e) => setNewAlert({ ...newAlert, price: e.target.value })}
                    className="form-input"
                    placeholder="Enter target price"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="modal-btn secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn primary"
                  onClick={handleCreateAlert}
                  disabled={!newAlert.price}
                >
                  Create Alert
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
