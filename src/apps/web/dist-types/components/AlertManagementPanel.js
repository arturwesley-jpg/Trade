import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Alert Management Panel Component
 * Allows users to create, view, and manage price alerts
 */
import { memo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
export const AlertManagementPanel = memo(function AlertManagementPanel({ symbol = "BTCUSDT" }) {
    const [alerts, setAlerts] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newAlert, setNewAlert] = useState({
        symbol,
        condition: "above",
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
        if (!newAlert.price)
            return;
        const alert = {
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
    const handleDeleteAlert = (id) => {
        setAlerts(alerts.filter(a => a.id !== id));
    };
    const handleSnoozeAlert = (id) => {
        setAlerts(alerts.map(a => a.id === id ? { ...a, status: "snoozed" } : a));
    };
    const getStatusColor = (status) => {
        switch (status) {
            case "active":
                return "var(--positive)";
            case "triggered":
                return "var(--warning)";
            case "snoozed":
                return "var(--muted)";
        }
    };
    return (_jsxs("div", { className: "alert-management-panel", children: [_jsxs("div", { className: "panel-header", children: [_jsx("h3", { children: "Price Alerts" }), _jsxs("button", { className: "create-alert-btn", onClick: () => setShowCreateModal(true), "aria-label": "Create new alert", children: [_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }), "New Alert"] })] }), _jsxs("div", { className: "alerts-list", children: [_jsx(AnimatePresence, { mode: "popLayout", children: alerts.map((alert, index) => (_jsxs(motion.div, { className: "alert-item", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, scale: 0.95 }, transition: { duration: 0.2, delay: index * 0.05 }, children: [_jsxs("div", { className: "alert-info", children: [_jsx("div", { className: "alert-symbol", children: alert.symbol }), _jsxs("div", { className: "alert-condition", children: [alert.condition === "above" ? "↑" : "↓", " $", alert.price.toLocaleString()] }), _jsx("div", { className: "alert-status", style: { color: getStatusColor(alert.status) }, children: alert.status })] }), _jsxs("div", { className: "alert-actions", children: [alert.status === "active" && (_jsx("button", { className: "alert-action-btn snooze", onClick: () => handleSnoozeAlert(alert.id), "aria-label": "Snooze alert", title: "Snooze", children: _jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" }) }) })), _jsx("button", { className: "alert-action-btn delete", onClick: () => handleDeleteAlert(alert.id), "aria-label": "Delete alert", title: "Delete", children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })] }) })] })] }, alert.id))) }), alerts.length === 0 && (_jsx("div", { className: "empty-state", children: _jsx("p", { children: "No alerts configured" }) }))] }), _jsx(AnimatePresence, { children: showCreateModal && (_jsx(motion.div, { className: "modal-backdrop", initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, onClick: () => setShowCreateModal(false), children: _jsxs(motion.div, { className: "modal-content", initial: { opacity: 0, scale: 0.95, y: 20 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95, y: 20 }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("h3", { children: "Create Price Alert" }), _jsx("button", { className: "modal-close", onClick: () => setShowCreateModal(false), "aria-label": "Close modal", children: _jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }), _jsxs("div", { className: "modal-body", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "alert-symbol", children: "Symbol" }), _jsx("input", { id: "alert-symbol", type: "text", value: newAlert.symbol, onChange: (e) => setNewAlert({ ...newAlert, symbol: e.target.value }), className: "form-input", placeholder: "BTCUSDT" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "alert-condition", children: "Condition" }), _jsxs("select", { id: "alert-condition", value: newAlert.condition, onChange: (e) => setNewAlert({ ...newAlert, condition: e.target.value }), className: "form-input", children: [_jsx("option", { value: "above", children: "Price Above" }), _jsx("option", { value: "below", children: "Price Below" })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "alert-price", children: "Price (USDT)" }), _jsx("input", { id: "alert-price", type: "number", step: "0.01", value: newAlert.price, onChange: (e) => setNewAlert({ ...newAlert, price: e.target.value }), className: "form-input", placeholder: "Enter target price" })] })] }), _jsxs("div", { className: "modal-footer", children: [_jsx("button", { className: "modal-btn secondary", onClick: () => setShowCreateModal(false), children: "Cancel" }), _jsx("button", { className: "modal-btn primary", onClick: handleCreateAlert, disabled: !newAlert.price, children: "Create Alert" })] })] }) })) })] }));
});
