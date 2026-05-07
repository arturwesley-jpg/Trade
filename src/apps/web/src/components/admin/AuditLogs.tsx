import { useState, useMemo } from "react";

export interface AuditLog {
  id: string;
  timestamp: string;
  eventType: string;
  userId?: string;
  userName?: string;
  action: string;
  resource: string;
  details: string;
  ipAddress?: string;
  success: boolean;
}

interface AuditLogsProps {
  logs: AuditLog[];
  onExport?: () => void;
  onRefresh?: () => void;
}

export function AuditLogs({ logs, onExport, onRefresh }: AuditLogsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [successFilter, setSuccessFilter] = useState<string>("all");

  const eventTypes = useMemo(() => {
    const types = new Set(logs.map((log) => log.eventType));
    return Array.from(types).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          log.action.toLowerCase().includes(query) ||
          log.resource.toLowerCase().includes(query) ||
          log.details.toLowerCase().includes(query) ||
          log.userName?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      if (eventTypeFilter !== "all" && log.eventType !== eventTypeFilter) {
        return false;
      }

      if (dateFilter) {
        const logDate = new Date(log.timestamp).toISOString().split("T")[0];
        if (logDate !== dateFilter) return false;
      }

      if (successFilter !== "all") {
        const isSuccess = successFilter === "success";
        if (log.success !== isSuccess) return false;
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

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div>
          <h2>Audit Logs</h2>
          <p>Searchable audit trail of all system events</p>
        </div>
        <div className="admin-actions">
          {onRefresh && (
            <button onClick={onRefresh} className="btn-secondary">
              Refresh
            </button>
          )}
          <button onClick={onExport || handleExportCSV} className="btn-primary">
            Export CSV
          </button>
        </div>
      </div>

      <div className="audit-filters">
        <div className="filter-group">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Search action, resource, user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Event Type:</label>
          <select value={eventTypeFilter} onChange={(e) => setEventTypeFilter(e.target.value)}>
            <option value="all">All</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Date:</label>
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Status:</label>
          <select value={successFilter} onChange={(e) => setSuccessFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>
      </div>

      <div className="audit-stats">
        <span>
          Showing {filteredLogs.length} of {logs.length} logs
        </span>
      </div>

      <div className="audit-table-container">
        <table className="admin-table audit-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Event Type</th>
              <th>User</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Details</th>
              <th>IP</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  No audit logs match the current filters
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className={log.success ? "" : "log-failure"}>
                  <td className="timestamp">{new Date(log.timestamp).toLocaleString()}</td>
                  <td>
                    <span className="event-type-badge">{log.eventType}</span>
                  </td>
                  <td>{log.userName || log.userId || "System"}</td>
                  <td>{log.action}</td>
                  <td className="resource">{log.resource}</td>
                  <td className="details">{log.details}</td>
                  <td className="ip">{log.ipAddress || "-"}</td>
                  <td>
                    <span className={`status-badge ${log.success ? "success" : "failure"}`}>
                      {log.success ? "✓" : "✗"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
