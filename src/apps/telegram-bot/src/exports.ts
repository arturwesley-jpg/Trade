/**
 * Telegram Bot Index Exports
 * Exports all commands and utilities for testing
 */

export { handleStart } from "./commands/start.js";
export { handleHelp } from "./commands/help.js";
export { handleStatus } from "./commands/status.js";
export { handleSignals } from "./commands/signals.js";
export { handlePositions } from "./commands/positions.js";
export { handleTrades } from "./commands/trades.js";
export { handleMetrics } from "./commands/metrics.js";
export { handleAlerts } from "./commands/alerts.js";

export { ApiClient, formatApiError } from "./utils/api.js";
export * from "./utils/formatters.js";

export { createAuthMiddleware, createAdminMiddleware } from "./middleware/auth.js";
export { createRateLimitMiddleware } from "./middleware/rate-limit.js";
export { createAuditMiddleware, getAuditLogs } from "./middleware/audit.js";
