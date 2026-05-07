import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Monitoring Dashboard Component
 * Displays real-time performance metrics and alerts
 */
import { useEffect, useState } from 'react';
import { performanceMonitor, alertingService } from '@trade/shared';
export function MonitoringDashboard() {
    const [metrics, setMetrics] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [selectedMetric, setSelectedMetric] = useState(null);
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
                .filter((s) => s !== null);
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
    const formatValue = (value, metricName) => {
        if (metricName.includes('cls')) {
            return value.toFixed(3);
        }
        return value.toFixed(2);
    };
    const getMetricStatus = (metricName, value) => {
        if (metricName === 'web_vitals_lcp') {
            if (value <= 2500)
                return 'good';
            if (value <= 4000)
                return 'warning';
            return 'poor';
        }
        if (metricName === 'web_vitals_fid') {
            if (value <= 100)
                return 'good';
            if (value <= 300)
                return 'warning';
            return 'poor';
        }
        if (metricName === 'web_vitals_cls') {
            if (value <= 0.1)
                return 'good';
            if (value <= 0.25)
                return 'warning';
            return 'poor';
        }
        if (metricName === 'api_request_duration') {
            if (value <= 500)
                return 'good';
            if (value <= 1000)
                return 'warning';
            return 'poor';
        }
        return 'good';
    };
    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'critical': return '#dc2626';
            case 'error': return '#ea580c';
            case 'warning': return '#f59e0b';
            case 'info': return '#3b82f6';
            default: return '#6b7280';
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'good': return '#10b981';
            case 'warning': return '#f59e0b';
            case 'poor': return '#ef4444';
            default: return '#6b7280';
        }
    };
    const activeAlerts = alerts.filter(a => !a.resolved);
    return (_jsxs("div", { style: { padding: '20px', fontFamily: 'system-ui, sans-serif' }, children: [_jsx("h1", { style: { fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }, children: "Performance Monitoring" }), activeAlerts.length > 0 && (_jsxs("div", { style: {
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px'
                }, children: [_jsxs("h2", { style: { fontSize: '18px', fontWeight: '600', marginBottom: '12px', color: '#991b1b' }, children: ["Active Alerts (", activeAlerts.length, ")"] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px' }, children: activeAlerts.slice(0, 5).map(alert => (_jsxs("div", { style: {
                                padding: '12px',
                                backgroundColor: 'white',
                                borderRadius: '6px',
                                borderLeft: `4px solid ${getSeverityColor(alert.severity)}`
                            }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'start' }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontWeight: '600', color: '#111827' }, children: alert.name }), _jsx("div", { style: { fontSize: '14px', color: '#6b7280', marginTop: '4px' }, children: alert.message })] }), _jsx("div", { style: {
                                                fontSize: '12px',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                backgroundColor: getSeverityColor(alert.severity),
                                                color: 'white',
                                                fontWeight: '600'
                                            }, children: alert.severity.toUpperCase() })] }), _jsx("div", { style: { fontSize: '12px', color: '#9ca3af', marginTop: '8px' }, children: new Date(alert.timestamp).toLocaleString() })] }, alert.id))) })] })), _jsx("div", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '16px',
                    marginBottom: '20px'
                }, children: metrics.map(metric => {
                    const status = getMetricStatus(metric.name, metric.avg);
                    return (_jsxs("div", { style: {
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '16px',
                            cursor: 'pointer',
                            transition: 'box-shadow 0.2s',
                            borderLeft: `4px solid ${getStatusColor(status)}`
                        }, onClick: () => setSelectedMetric(metric.name), children: [_jsx("div", { style: { fontSize: '14px', color: '#6b7280', marginBottom: '8px' }, children: metric.name.replace(/_/g, ' ').toUpperCase() }), _jsxs("div", { style: { fontSize: '28px', fontWeight: 'bold', color: '#111827', marginBottom: '12px' }, children: [formatValue(metric.avg, metric.name), _jsx("span", { style: { fontSize: '14px', color: '#6b7280', marginLeft: '4px' }, children: metric.name.includes('cls') ? '' : 'ms' })] }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }, children: [_jsxs("div", { children: [_jsx("div", { style: { color: '#6b7280' }, children: "Min" }), _jsx("div", { style: { fontWeight: '600' }, children: formatValue(metric.min, metric.name) })] }), _jsxs("div", { children: [_jsx("div", { style: { color: '#6b7280' }, children: "Max" }), _jsx("div", { style: { fontWeight: '600' }, children: formatValue(metric.max, metric.name) })] }), _jsxs("div", { children: [_jsx("div", { style: { color: '#6b7280' }, children: "P95" }), _jsx("div", { style: { fontWeight: '600' }, children: formatValue(metric.p95, metric.name) })] }), _jsxs("div", { children: [_jsx("div", { style: { color: '#6b7280' }, children: "P99" }), _jsx("div", { style: { fontWeight: '600' }, children: formatValue(metric.p99, metric.name) })] })] }), _jsxs("div", { style: { marginTop: '8px', fontSize: '12px', color: '#6b7280' }, children: [metric.count, " samples"] })] }, metric.name));
                }) }), _jsxs("div", { style: {
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px'
                }, children: [_jsx("h2", { style: { fontSize: '18px', fontWeight: '600', marginBottom: '12px' }, children: "Recent Alerts" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px' }, children: alerts.slice(0, 10).map(alert => (_jsxs("div", { style: {
                                padding: '12px',
                                backgroundColor: alert.resolved ? '#f9fafb' : 'white',
                                borderRadius: '6px',
                                border: '1px solid #e5e7eb',
                                opacity: alert.resolved ? 0.6 : 1
                            }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontWeight: '600', fontSize: '14px' }, children: alert.name }), _jsx("div", { style: { fontSize: '13px', color: '#6b7280', marginTop: '2px' }, children: alert.message })] }), _jsxs("div", { style: { display: 'flex', gap: '8px', alignItems: 'center' }, children: [_jsx("div", { style: {
                                                        fontSize: '11px',
                                                        padding: '3px 6px',
                                                        borderRadius: '3px',
                                                        backgroundColor: getSeverityColor(alert.severity),
                                                        color: 'white',
                                                        fontWeight: '600'
                                                    }, children: alert.severity }), alert.resolved && (_jsx("div", { style: {
                                                        fontSize: '11px',
                                                        padding: '3px 6px',
                                                        borderRadius: '3px',
                                                        backgroundColor: '#10b981',
                                                        color: 'white',
                                                        fontWeight: '600'
                                                    }, children: "RESOLVED" }))] })] }), _jsx("div", { style: { fontSize: '11px', color: '#9ca3af', marginTop: '6px' }, children: new Date(alert.timestamp).toLocaleString() })] }, alert.id))) })] })] }));
}
