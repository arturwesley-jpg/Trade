// Admin API Service

import type {
  SystemStats,
  UserListItem,
  UserDetail,
  AdminAlert,
  AdminSignal,
  AdminTrade,
  SystemLog,
  DatabaseStats,
  ApiUsageStats,
  AuditLog,
} from "../types/admin";

const API_BASE = "/api/admin";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("adminToken");

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new ApiError(response.status, error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const adminApi = {
  // Authentication
  login: async (email: string, password: string) => {
    const response = await fetchApi<{ accessToken: string; user: { role: string } }>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (response.user.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    localStorage.setItem("adminToken", response.accessToken);
    return response;
  },

  logout: () => {
    localStorage.removeItem("adminToken");
  },

  // System Stats
  getStats: () => fetchApi<SystemStats>("/stats"),

  // Users
  getUsers: (params?: { page?: number; limit?: number; search?: string; role?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.search) query.set("search", params.search);
    if (params?.role) query.set("role", params.role);

    return fetchApi<{ users: UserListItem[]; total: number; page: number; limit: number }>(
      `/users?${query}`
    );
  },

  getUserById: (id: string) => fetchApi<UserDetail>(`/users/${id}`),

  suspendUser: (id: string, reason: string) =>
    fetchApi<{ success: boolean }>(`/users/${id}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  activateUser: (id: string) =>
    fetchApi<{ success: boolean }>(`/users/${id}/activate`, {
      method: "POST",
    }),

  deleteUser: (id: string) =>
    fetchApi<{ success: boolean }>(`/users/${id}`, {
      method: "DELETE",
    }),

  // Alerts
  getAlerts: (params?: { page?: number; limit?: number; userId?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.userId) query.set("userId", params.userId);
    if (params?.status) query.set("status", params.status);

    return fetchApi<{ alerts: AdminAlert[]; total: number }>(
      `/alerts?${query}`
    );
  },

  // Signals
  getSignals: (params?: { page?: number; limit?: number; symbol?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.symbol) query.set("symbol", params.symbol);

    return fetchApi<{ signals: AdminSignal[]; total: number }>(
      `/signals?${query}`
    );
  },

  // Trades
  getTrades: (params?: { page?: number; limit?: number; userId?: string; symbol?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.userId) query.set("userId", params.userId);
    if (params?.symbol) query.set("symbol", params.symbol);

    return fetchApi<{ trades: AdminTrade[]; total: number }>(
      `/trades?${query}`
    );
  },

  // Logs
  getLogs: (params?: { page?: number; limit?: number; level?: string; service?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.level) query.set("level", params.level);
    if (params?.service) query.set("service", params.service);

    return fetchApi<{ logs: SystemLog[]; total: number }>(
      `/logs?${query}`
    );
  },

  // Database Stats
  getDatabaseStats: () => fetchApi<DatabaseStats[]>("/database/stats"),

  // API Usage
  getApiUsage: (params?: { hours?: number }) => {
    const query = new URLSearchParams();
    if (params?.hours) query.set("hours", params.hours.toString());

    return fetchApi<ApiUsageStats[]>(`/api-usage?${query}`);
  },

  // Audit Logs
  getAuditLogs: (params?: { page?: number; limit?: number; adminId?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", params.page.toString());
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.adminId) query.set("adminId", params.adminId);

    return fetchApi<{ logs: AuditLog[]; total: number }>(
      `/audit-logs?${query}`
    );
  },
};
