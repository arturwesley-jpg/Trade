// Admin Dashboard Types

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalTrades: number;
  totalVolume: number;
  totalAlerts: number;
  activeAlerts: number;
  totalSignals: number;
  apiRequests24h: number;
  errorRate: number;
  avgResponseTime: number;
  databaseSize: string;
  uptime: number;
}

export interface UserListItem {
  id: string;
  email: string;
  name?: string;
  role: "user" | "admin" | "viewer";
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
  totalTrades: number;
  totalVolume: number;
}

export interface UserDetail extends UserListItem {
  updatedAt: string;
  positions: number;
  alerts: number;
  signals: number;
  apiUsage24h: number;
}

export interface AdminAlert {
  id: string;
  userId: string;
  userEmail: string;
  type: string;
  name: string;
  status: string;
  priority: string;
  symbol?: string;
  triggerCount: number;
  lastTriggeredAt?: string;
  createdAt: string;
}

export interface AdminSignal {
  id: string;
  symbol: string;
  direction: string;
  confidence: string;
  priceChangePct: number;
  shouldExecute: boolean;
  rationale: string;
  createdAt: string;
  status?: string;
}

export interface AdminTrade {
  id: string;
  userId: string;
  userEmail: string;
  positionId: string;
  symbol: string;
  side: string;
  mode: string;
  entryPrice: number;
  exitPrice?: number;
  pnlUsdt: number;
  marginUsdt: number;
  status: string;
  openedAt: string;
  closedAt?: string;
}

export interface SystemLog {
  id: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
  service: string;
  metadata?: Record<string, unknown>;
}

export interface DatabaseStats {
  tableName: string;
  rowCount: number;
  sizeBytes: number;
  indexSize: number;
}

export interface ApiUsageStats {
  endpoint: string;
  method: string;
  count: number;
  avgResponseTime: number;
  errorCount: number;
  errorRate: number;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
}
