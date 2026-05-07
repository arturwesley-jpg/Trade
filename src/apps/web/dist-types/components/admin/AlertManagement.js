import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function AlertManagement({ alerts, onAcknowledge, onResolve, onCreate }) {
    const [filter, setFilter] = useState("all");
    const [severityFilter, setSeverityFilter] = useState("all");
    const [showCreateForm, setShowCreateForm] = useState(false);
    const filteredAlerts = alerts.filter((alert) => {
        if (filter !== "all" && alert.status !== filter)
            return false;
        if (severityFilter !== "all" && alert.severity !== severityFilter)
            return false;
        return true;
    });
    const openAlerts = alerts.filter((a) => a.status === "OPEN").length;
    const ackedAlerts = alerts.filter((a) => a.status === "ACKED").length;
    const resolvedAlerts = alerts.filter((a) => a.status === "RESOLVED").length;
    return (_jsxs("div", { className: "admin-section", children: [_jsxs("div", { className: "admin-section-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Alert Management" }), _jsx("p", { children: "Monitor and manage system alerts" })] }), onCreate && (_jsx("button", { onClick: () => setShowCreateForm(true), className: "btn-primary", children: "Create Alert Rule" }))] }), _jsxs("div", { className: "stats-grid", children: [_jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-label", children: "Open Alerts" }), _jsx("strong", { className: "stat-value text-danger", children: openAlerts })] }), _jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-label", children: "Acknowledged" }), _jsx("strong", { className: "stat-value text-warning", children: ackedAlerts })] }), _jsxs("div", { className: "stat-card", children: [_jsx("span", { className: "stat-label", children: "Resolved" }), _jsx("strong", { className: "stat-value text-success", children: resolvedAlerts })] })] }), _jsxs("div", { className: "alert-filters", children: [_jsxs("div", { className: "filter-group", children: [_jsx("label", { children: "Status:" }), _jsxs("select", { value: filter, onChange: (e) => setFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "OPEN", children: "Open" }), _jsx("option", { value: "ACKED", children: "Acknowledged" }), _jsx("option", { value: "RESOLVED", children: "Resolved" })] })] }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { children: "Severity:" }), _jsxs("select", { value: severityFilter, onChange: (e) => setSeverityFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "high", children: "High" })] })] })] }), _jsx("div", { className: "alerts-list", children: filteredAlerts.length === 0 ? (_jsx("div", { className: "empty-state", children: "No alerts match the current filters" })) : (filteredAlerts.map((alert) => (_jsx(AlertCard, { alert: alert, onAcknowledge: onAcknowledge, onResolve: onResolve }, alert.id)))) }), showCreateForm && onCreate && (_jsx(CreateAlertForm, { onSubmit: async (data) => {
                    await onCreate(data);
                    setShowCreateForm(false);
                }, onCancel: () => setShowCreateForm(false) }))] }));
}
function AlertCard({ alert, onAcknowledge, onResolve }) {
    const [loading, setLoading] = useState(false);
    const handleAction = async (action) => {
        setLoading(true);
        try {
            await action();
        }
        finally {
            setLoading(false);
        }
    };
    const severityColor = {
        low: "var(--color-info, #3b82f6)",
        medium: "var(--color-warning, #f59e0b)",
        high: "var(--color-danger, #ef4444)"
    }[alert.severity];
    return (_jsxs("div", { className: "alert-card", style: { borderLeftColor: severityColor }, children: [_jsxs("div", { className: "alert-card-header", children: [_jsxs("div", { children: [_jsx("span", { className: `alert-badge severity-${alert.severity}`, children: alert.severity.toUpperCase() }), _jsx("span", { className: `alert-badge status-${alert.status.toLowerCase()}`, children: alert.status }), _jsx("span", { className: "alert-type", children: alert.type })] }), _jsxs("div", { className: "alert-actions", children: [alert.status === "OPEN" && (_jsx("button", { onClick: () => handleAction(() => onAcknowledge(alert.id)), disabled: loading, className: "btn-secondary btn-sm", children: "Acknowledge" })), alert.status !== "RESOLVED" && (_jsx("button", { onClick: () => handleAction(() => onResolve(alert.id)), disabled: loading, className: "btn-primary btn-sm", children: "Resolve" }))] })] }), _jsx("h3", { children: alert.title }), _jsx("p", { children: alert.message }), _jsxs("div", { className: "alert-footer", children: [_jsxs("small", { children: ["Created: ", new Date(alert.createdAt).toLocaleString()] }), alert.resolvedAt && _jsxs("small", { children: ["Resolved: ", new Date(alert.resolvedAt).toLocaleString()] })] })] }));
}
function CreateAlertForm({ onSubmit, onCancel }) {
    const [formData, setFormData] = useState({
        type: "TECHNICAL",
        title: "",
        message: "",
        severity: "medium"
    });
    const [loading, setLoading] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit(formData);
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "modal-backdrop", children: _jsxs("div", { className: "modal-content", children: [_jsx("h3", { children: "Create Alert Rule" }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Type" }), _jsxs("select", { value: formData.type, onChange: (e) => setFormData({ ...formData, type: e.target.value }), required: true, children: [_jsx("option", { value: "PRICE", children: "Price" }), _jsx("option", { value: "TECHNICAL", children: "Technical" }), _jsx("option", { value: "WHALE", children: "Whale" }), _jsx("option", { value: "NEWS", children: "News" }), _jsx("option", { value: "SENTIMENT", children: "Sentiment" }), _jsx("option", { value: "RISK", children: "Risk" })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Severity" }), _jsxs("select", { value: formData.severity, onChange: (e) => setFormData({ ...formData, severity: e.target.value }), required: true, children: [_jsx("option", { value: "low", children: "Low" }), _jsx("option", { value: "medium", children: "Medium" }), _jsx("option", { value: "high", children: "High" })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Title" }), _jsx("input", { type: "text", value: formData.title, onChange: (e) => setFormData({ ...formData, title: e.target.value }), required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Message" }), _jsx("textarea", { value: formData.message, onChange: (e) => setFormData({ ...formData, message: e.target.value }), rows: 4, required: true })] }), _jsxs("div", { className: "form-actions", children: [_jsx("button", { type: "button", onClick: onCancel, className: "btn-secondary", children: "Cancel" }), _jsx("button", { type: "submit", disabled: loading, className: "btn-primary", children: loading ? "Creating..." : "Create Alert" })] })] })] }) }));
}
