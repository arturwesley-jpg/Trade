/**
 * Alerting Service
 * Monitors metrics and triggers alerts based on thresholds
 */

import { performanceMonitor, type PerformanceMetric } from './performance-monitor.js';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface Alert {
  id: string;
  name: string;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  metric?: PerformanceMetric;
  resolved: boolean;
  resolvedAt?: number;
}

export interface AlertRule {
  name: string;
  metricName: string;
  condition: 'above' | 'below' | 'equals';
  threshold: number;
  duration?: number; // How long condition must be true (ms)
  severity: AlertSeverity;
  message: string;
  enabled: boolean;
}

export interface AlertingConfig {
  rules: AlertRule[];
  cooldownMs?: number; // Minimum time between same alerts
  maxAlerts?: number; // Maximum alerts to keep in memory
}

export class AlertingService {
  private alerts: Alert[] = [];
  private rules: Map<string, AlertRule> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private cooldownMs: number;
  private maxAlerts: number;
  private listeners: Array<(alert: Alert) => void> = [];
  private unsubscribe?: () => void;

  constructor(config: AlertingConfig) {
    this.cooldownMs = config.cooldownMs ?? 60000; // 1 minute default
    this.maxAlerts = config.maxAlerts ?? 1000;

    config.rules.forEach(rule => {
      this.rules.set(rule.name, rule);
    });

    // Subscribe to performance metrics
    this.unsubscribe = performanceMonitor.subscribe(metric => {
      this.evaluateMetric(metric);
    });
  }

  /**
   * Add or update an alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.name, rule);
  }

  /**
   * Remove an alert rule
   */
  removeRule(name: string): void {
    this.rules.delete(name);
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(name: string, enabled: boolean): void {
    const rule = this.rules.get(name);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Evaluate a metric against all rules
   */
  private evaluateMetric(metric: PerformanceMetric): void {
    this.rules.forEach(rule => {
      if (!rule.enabled || rule.metricName !== metric.name) {
        return;
      }

      const triggered = this.checkCondition(metric.value, rule);

      if (triggered) {
        this.triggerAlert(rule, metric);
      }
    });
  }

  /**
   * Check if a condition is met
   */
  private checkCondition(value: number, rule: AlertRule): boolean {
    switch (rule.condition) {
      case 'above':
        return value > rule.threshold;
      case 'below':
        return value < rule.threshold;
      case 'equals':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, metric: PerformanceMetric): void {
    const now = Date.now();
    const lastAlert = this.lastAlertTime.get(rule.name);

    // Check cooldown
    if (lastAlert && now - lastAlert < this.cooldownMs) {
      return;
    }

    const alert: Alert = {
      id: `alert-${now}-${Math.random().toString(36).substring(7)}`,
      name: rule.name,
      severity: rule.severity,
      message: rule.message,
      timestamp: now,
      metric,
      resolved: false
    };

    this.alerts.push(alert);
    this.lastAlertTime.set(rule.name, now);

    // Trim old alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(alert));
  }

  /**
   * Manually create an alert
   */
  createAlert(
    name: string,
    severity: AlertSeverity,
    message: string,
    metric?: PerformanceMetric
  ): Alert {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name,
      severity,
      message,
      timestamp: Date.now(),
      metric,
      resolved: false
    };

    this.alerts.push(alert);

    // Trim old alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(alert));

    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Get all alerts
   */
  getAlerts(options?: {
    severity?: AlertSeverity;
    resolved?: boolean;
    since?: number;
  }): Alert[] {
    let filtered = [...this.alerts];

    if (options?.severity) {
      filtered = filtered.filter(a => a.severity === options.severity);
    }

    if (options?.resolved !== undefined) {
      filtered = filtered.filter(a => a.resolved === options.resolved);
    }

    if (options?.since) {
      filtered = filtered.filter(a => a.timestamp >= options.since!);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get active (unresolved) alerts
   */
  getActiveAlerts(): Alert[] {
    return this.getAlerts({ resolved: false });
  }

  /**
   * Subscribe to alert events
   */
  subscribe(listener: (alert: Alert) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Clear all alerts
   */
  clear(): void {
    this.alerts = [];
    this.lastAlertTime.clear();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.listeners = [];
  }
}

// Default alert rules
export const defaultAlertRules: AlertRule[] = [
  // Frontend performance
  {
    name: 'high_lcp',
    metricName: 'web_vitals_lcp',
    condition: 'above',
    threshold: 2500, // 2.5s
    severity: 'warning',
    message: 'Largest Contentful Paint is above 2.5s',
    enabled: true
  },
  {
    name: 'high_fid',
    metricName: 'web_vitals_fid',
    condition: 'above',
    threshold: 100, // 100ms
    severity: 'warning',
    message: 'First Input Delay is above 100ms',
    enabled: true
  },
  {
    name: 'high_cls',
    metricName: 'web_vitals_cls',
    condition: 'above',
    threshold: 0.1,
    severity: 'warning',
    message: 'Cumulative Layout Shift is above 0.1',
    enabled: true
  },

  // API performance
  {
    name: 'slow_api_response',
    metricName: 'api_request_duration',
    condition: 'above',
    threshold: 1000, // 1s
    severity: 'warning',
    message: 'API response time is above 1s',
    enabled: true
  },
  {
    name: 'critical_api_response',
    metricName: 'api_request_duration',
    condition: 'above',
    threshold: 5000, // 5s
    severity: 'error',
    message: 'API response time is above 5s',
    enabled: true
  },

  // WebSocket
  {
    name: 'high_websocket_latency',
    metricName: 'websocket_latency',
    condition: 'above',
    threshold: 500, // 500ms
    severity: 'warning',
    message: 'WebSocket latency is above 500ms',
    enabled: true
  },
  {
    name: 'websocket_reconnections',
    metricName: 'websocket_reconnections',
    condition: 'above',
    threshold: 5,
    severity: 'error',
    message: 'High number of WebSocket reconnections detected',
    enabled: true
  },

  // Database
  {
    name: 'slow_database_query',
    metricName: 'db_query_time',
    condition: 'above',
    threshold: 500, // 500ms
    severity: 'warning',
    message: 'Database query time is above 500ms',
    enabled: true
  },
  {
    name: 'high_slow_queries',
    metricName: 'db_slow_queries',
    condition: 'above',
    threshold: 10,
    severity: 'error',
    message: 'High number of slow database queries',
    enabled: true
  }
];

// Singleton instance
export const alertingService = new AlertingService({
  rules: defaultAlertRules,
  cooldownMs: 60000, // 1 minute
  maxAlerts: 1000
});
