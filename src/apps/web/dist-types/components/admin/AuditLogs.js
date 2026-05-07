import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from "react";
export function AuditLogs({ logs, onExport, onRefresh }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [eventTypeFilter, setEventTypeFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("");
    const [successFilter, setSuccessFilter] = useState("all");
    const eventTypes = useMemo(() => {
        const types = new Set(logs.map((log) => log.eventType));
        return Array.from(types).sort();
    }, [logs]);
    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesSearch = log.action.toLowerCase().includes(query) ||
                    log.resource.toLowerCase().includes(query) ||
                    log.details.toLowerCase().includes(query) ||
                    log.userName?.toLowerCase().includes(query);
                if (!matchesSearch)
                    return false;
            }
            if (eventTypeFilter !== "all" && log.eventType !== eventTypeFilter) {
                return false;
            }
            if (dateFilter) {
                const logDate = new Date(log.timestamp).toISOString().split("T")[0];
                if (logDate !== dateFilter)
                    return false;
            }
            if (successFilter !== "all") {
                const isSuccess = successFilter === "success";
                if (log.success !== isSuccess)
                    return false;
            }
            return true;
        });
    }, [logs, searchQuery, eventTypeFilter, dateFilter, successFilter]);
    const handleExportCSV = () => {
        const headers = ["Timestamp", "Event Type", "User", "Action", "Resource", "Details", "IP", "Success"];
        const rows = filteredLogs.map((log) => [
            log.timestamp,
            log.eventType,
            log.userName || log.userId || "System",
            log.action,
            log.resource,
            log.details,
            log.ipAddress || "",
            log.success ? "Yes" : "No"
        ]);
        const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };
    return (_jsxs("div", { className: "admin-section", children: [_jsxs("div", { className: "admin-section-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Audit Logs" }), _jsx("p", { children: "Searchable audit trail of all system events" })] }), _jsxs("div", { className: "admin-actions", children: [onRefresh && (_jsx("button", { onClick: onRefresh, className: "btn-secondary", children: "Refresh" })), _jsx("button", { onClick: onExport || handleExportCSV, className: "btn-primary", children: "Export CSV" })] })] }), _jsxs("div", { className: "audit-filters", children: [_jsxs("div", { className: "filter-group", children: [_jsx("label", { children: "Search:" }), _jsx("input", { type: "text", placeholder: "Search action, resource, user...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value) })] }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { children: "Event Type:" }), _jsxs("select", { value: eventTypeFilter, onChange: (e) => setEventTypeFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All" }), eventTypes.map((type) => (_jsx("option", { value: type, children: type }, type)))] })] }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { children: "Date:" }), _jsx("input", { type: "date", value: dateFilter, onChange: (e) => setDateFilter(e.target.value) })] }), _jsxs("div", { className: "filter-group", children: [_jsx("label", { children: "Status:" }), _jsxs("select", { value: successFilter, onChange: (e) => setSuccessFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All" }), _jsx("option", { value: "success", children: "Success" }), _jsx("option", { value: "failure", children: "Failure" })] })] })] }), _jsx("div", { className: "audit-stats", children: _jsxs("span", { children: ["Showing ", filteredLogs.length, " of ", logs.length, " logs"] }) }), _jsx("div", { className: "audit-table-container", children: _jsxs("table", { className: "admin-table audit-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Timestamp" }), _jsx("th", { children: "Event Type" }), _jsx("th", { children: "User" }), _jsx("th", { children: "Action" }), _jsx("th", { children: "Resource" }), _jsx("th", { children: "Details" }), _jsx("th", { children: "IP" }), _jsx("th", { children: "Status" })] }) }), _jsx("tbody", { children: filteredLogs.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 8, className: "empty-state", children: "No audit logs match the current filters" }) })) : (filteredLogs.map((log) => (_jsxs("tr", { className: log.success ? "" : "log-failure", children: [_jsx("td", { className: "timestamp", children: new Date(log.timestamp).toLocaleString() }), _jsx("td", { children: _jsx("span", { className: "event-type-badge", children: log.eventType }) }), _jsx("td", { children: log.userName || log.userId || "System" }), _jsx("td", { children: log.action }), _jsx("td", { className: "resource", children: log.resource }), _jsx("td", { className: "details", children: log.details }), _jsx("td", { className: "ip", children: log.ipAddress || "-" }), _jsx("td", { children: _jsx("span", { className: `status-badge ${log.success ? "success" : "failure"}`, children: log.success ? "✓" : "✗" }) })] }, log.id)))) })] }) })] }));
}
