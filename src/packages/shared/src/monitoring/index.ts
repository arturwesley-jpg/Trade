/**
 * Monitoring Package Index
 * Exports all monitoring services
 */

export { performanceMonitor, PerformanceMonitor } from './performance-monitor.js';
export type {
  PerformanceMetric,
  WebVitalsMetrics,
  APIPerformanceMetrics,
  WebSocketMetrics,
  DatabaseMetrics
} from './performance-monitor.js';

export { alertingService, AlertingService, defaultAlertRules } from './alerting.js';
export type {
  Alert,
  AlertRule,
  AlertSeverity,
  AlertingConfig
} from './alerting.js';

export {
  healthChecker,
  HealthCheckService,
  registerPostgres,
  registerRedis,
  registerWebSocket,
  registerAPI
} from './health-check.js';
export type {
  HealthCheckResult,
  ComponentHealth,
  HealthCheckFunction
} from './health-check.js';

export {
  errorTracker,
  ErrorTracker,
  setupFrontendErrorTracking,
  setupBackendErrorTracking
} from './error-tracker.js';
export type { ErrorReport } from './error-tracker.js';

export {
  degradationManager,
  DegradationManager,
  CircuitBreaker,
  DegradationCache,
  retryWithBackoff
} from './graceful-degradation.js';
export type { DegradationStrategy } from './graceful-degradation.js';

export { profiler, Profiler, Profile, CPUProfiler } from './profiler.js';
export type { PerformanceMetric as ProfilerMetric, MemorySnapshot } from './profiler.js';

export { metrics, MetricsCollector } from './metrics.js';
export type { MetricPoint, AggregatedMetric } from './metrics.js';
