import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../services/api";
import { StatsOverview } from "../components/StatsOverview";
import { UsersTable } from "../components/UsersTable";
import { AlertsTable } from "../components/AlertsTable";
import { TradesTable } from "../components/TradesTable";
import { LogsViewer } from "../components/LogsViewer";
import { ApiUsageChart, TradingVolumeChart } from "../components/Charts";
import { DatabaseStatsTable } from "../components/DatabaseStats";

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "alerts" | "trades" | "logs" | "database">(
    "overview"
  );

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.getStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: usersData, refetch: refetchUsers } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminApi.getUsers({ limit: 50 }),
    enabled: activeTab === "users",
  });

  const { data: alertsData } = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => adminApi.getAlerts({ limit: 50 }),
    enabled: activeTab === "alerts",
  });

  const { data: tradesData } = useQuery({
    queryKey: ["admin-trades"],
    queryFn: () => adminApi.getTrades({ limit: 50 }),
    enabled: activeTab === "trades",
  });

  const { data: logsData } = useQuery({
    queryKey: ["admin-logs"],
    queryFn: () => adminApi.getLogs({ limit: 100 }),
    enabled: activeTab === "logs",
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: apiUsageData } = useQuery({
    queryKey: ["admin-api-usage"],
    queryFn: () => adminApi.getApiUsage({ hours: 24 }),
    enabled: activeTab === "overview",
  });

  const { data: dbStats } = useQuery({
    queryKey: ["admin-db-stats"],
    queryFn: () => adminApi.getDatabaseStats(),
    enabled: activeTab === "database",
  });

  const handleSuspendUser = async (userId: string) => {
    try {
      await adminApi.suspendUser(userId, "Suspended by admin");
      refetchUsers();
    } catch (error) {
      alert("Failed to suspend user");
    }
  };

  const handleActivateUser = async (userId: string) => {
    try {
      await adminApi.activateUser(userId);
      refetchUsers();
    } catch (error) {
      alert("Failed to activate user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await adminApi.deleteUser(userId);
      refetchUsers();
    } catch (error) {
      alert("Failed to delete user");
    }
  };

  const handleViewUserDetails = (userId: string) => {
    // Navigate to user details page or show modal
    console.log("View user details:", userId);
  };

  const handleLogout = () => {
    adminApi.logout();
    window.location.reload();
  };

  // Mock trading volume data (replace with real data from API)
  const tradingVolumeData = [
    { date: "Mon", volume: 125000, trades: 450 },
    { date: "Tue", volume: 142000, trades: 520 },
    { date: "Wed", volume: 138000, trades: 490 },
    { date: "Thu", volume: 156000, trades: 580 },
    { date: "Fri", volume: 171000, trades: 620 },
    { date: "Sat", volume: 148000, trades: 510 },
    { date: "Sun", volume: 132000, trades: 470 },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* Header */}
      <header
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-color)",
          padding: "1rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700" }}>Admin Dashboard</h1>
        <button onClick={handleLogout} className="btn btn-secondary">
          Logout
        </button>
      </header>

      {/* Navigation Tabs */}
      <nav
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-color)",
          padding: "0 2rem",
          display: "flex",
          gap: "2rem",
        }}
      >
        {[
          { id: "overview", label: "Overview" },
          { id: "users", label: "Users" },
          { id: "alerts", label: "Alerts" },
          { id: "trades", label: "Trades" },
          { id: "logs", label: "Logs" },
          { id: "database", label: "Database" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{
              background: "none",
              border: "none",
              padding: "1rem 0",
              color: activeTab === tab.id ? "var(--accent-primary)" : "var(--text-secondary)",
              fontWeight: activeTab === tab.id ? "600" : "400",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent-primary)" : "2px solid transparent",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main style={{ padding: "2rem" }}>
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {stats && <StatsOverview stats={stats} />}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
              {apiUsageData && <ApiUsageChart data={apiUsageData} />}
              <TradingVolumeChart data={tradingVolumeData} />
            </div>
          </div>
        )}

        {activeTab === "users" && usersData && (
          <UsersTable
            users={usersData.users}
            onSuspend={handleSuspendUser}
            onActivate={handleActivateUser}
            onDelete={handleDeleteUser}
            onViewDetails={handleViewUserDetails}
          />
        )}

        {activeTab === "alerts" && alertsData && <AlertsTable alerts={alertsData.alerts} />}

        {activeTab === "trades" && tradesData && <TradesTable trades={tradesData.trades} />}

        {activeTab === "logs" && logsData && <LogsViewer logs={logsData.logs} />}

        {activeTab === "database" && dbStats && <DatabaseStatsTable stats={dbStats} />}
      </main>
    </div>
  );
}
