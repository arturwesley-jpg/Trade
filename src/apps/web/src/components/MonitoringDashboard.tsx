/**
 * Monitoring Dashboard Component
 * Displays real-time performance metrics and alerts
 */

import { useEffect, useState } from 'react';
import {
  performanceMonitor,
  alertingService,
  type PerformanceMetric,
  type Alert
} from '@trade/shared';

interface MetricStats {
  name: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<MetricStats[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  useEffect(() => {
    // Update metrics every 5 seconds
    const updateMetrics = () => {
      const metricNames = [
        'web_vitals_lcp',
        'web_vitals_fid',
        'web_vitals_cls',
        'api_request_duration',
        'websocket_latency',
        'db_query_duration'
      ];

      const stats = metricNames
        .map(name => {
          const stat = performanceMonitor.getStats(name, Date.now() - 300000); // Last 5 minutes
          return stat ? { name, ...stat } : null;
        })
        .filter((s): s is MetricStats => s !== null);

      setMetrics(stats);
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Subscribe to alerts
    const unsubscribe = alertingService.subscribe((alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 50)); // Keep last 50 alerts
    });

    // Load existing alerts
    setAlerts(alertingService.getAlerts({ since: Date.now() - 3600000 })); // Last hour

    return unsubscribe;
  }, []);

  const formatValue = (value: number, metricName: string): string => {
    if (metricName.includes('cls')) {
      return value.toFixed(3);
    }
    return value.toFixed(2);
  };

  const getMetricStatus = (metricName: string, value: number): 'good' | 'warning' | 'poor' => {
    if (metricName === 'web_vitals_lcp') {
      if (value <= 2500) return 'good';
      if (value <= 4000) return 'warning';
      return 'poor';
    }
    if (metricName === 'web_vitals_fid') {
      if (value <= 100) return 'good';
      if (value <= 300) return 'warning';
      return 'poor';
    }
    if (metricName === 'web_vitals_cls') {
      if (value <= 0.1) return 'good';
      if (value <= 0.25) return 'warning';
      return 'poor';
    }
    if (metricName === 'api_request_duration') {
      if (value <= 500) return 'good';
      if (value <= 1000) return 'warning';
      return 'poor';
    }
    return 'good';
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'error': return '#ea580c';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'good': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'poor': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const activeAlerts = alerts.filter(a => !a.resolved);

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>
        Performance Monitoring
      </h1>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#991b1b' }}>
            Active Alerts ({activeAlerts.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeAlerts.slice(0, 5).map(alert => (
              <div
                key={alert.id}
                style={{
                  padding: '12px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  borderLeft: `4px solid ${getSeverityColor(alert.severity)}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: '600', color: '#111827' }}>{alert.name}</div>
                    <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                      {alert.message}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: getSeverityColor(alert.severity),
                    color: 'white',
                    fontWeight: '600'
                  }}>
                    {alert.severity.toUpperCase()}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                  {new Date(alert.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {metrics.map(metric => {
          const status = getMetricStatus(metric.name, metric.avg);
          return (
            <div
              key={metric.name}
              style={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
                borderLeft: `4px solid ${getStatusColor(status)}`
              }}
              onClick={() => setSelectedMetric(metric.name)}
            >
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                {metric.name.replace(/_/g, ' ').toUpperCase()}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', marginBottom: '12px' }}>
                {formatValue(metric.avg, metric.name)}
                <span style={{ fontSize: '14px', color: '#6b7280', marginLeft: '4px' }}>
                  {metric.name.includes('cls') ? '' : 'ms'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: '#6b7280' }}>Min</div>
                  <div style={{ fontWeight: '600' }}>{formatValue(metric.min, metric.name)}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280' }}>Max</div>
                  <div style={{ fontWeight: '600' }}>{formatValue(metric.max, metric.name)}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280' }}>P95</div>
                  <div style={{ fontWeight: '600' }}>{formatValue(metric.p95, metric.name)}</div>
                </div>
                <div>
                  <div style={{ color: '#6b7280' }}>P99</div>
                  <div style={{ fontWeight: '600' }}>{formatValue(metric.p99, metric.name)}</div>
                </div>
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                {metric.count} samples
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Alerts History */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>
          Recent Alerts
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.slice(0, 10).map(alert => (
            <div
              key={alert.id}
              style={{
                padding: '12px',
                backgroundColor: alert.resolved ? '#f9fafb' : 'white',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                opacity: alert.resolved ? 0.6 : 1
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{alert.name}</div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                    {alert.message}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{
                    fontSize: '11px',
                    padding: '3px 6px',
                    borderRadius: '3px',
                    backgroundColor: getSeverityColor(alert.severity),
                    color: 'white',
                    fontWeight: '600'
                  }}>
                    {alert.severity}
                  </div>
                  {alert.resolved && (
                    <div style={{
                      fontSize: '11px',
                      padding: '3px 6px',
                      borderRadius: '3px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      fontWeight: '600'
                    }}>
                      RESOLVED
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>
                {new Date(alert.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
