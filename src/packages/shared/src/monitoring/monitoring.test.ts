/**
 * Monitoring Tests
 * Tests for performance monitoring, alerting, and health checks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performanceMonitor } from './performance-monitor.js';
import { alertingService, AlertingService } from './alerting.js';
import { healthChecker, HealthCheckService } from './health-check.js';
import { errorTracker } from './error-tracker.js';
import { CircuitBreaker, retryWithBackoff, DegradationCache } from './graceful-degradation.js';

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    performanceMonitor.clear();
  });

  it('should record performance metrics', () => {
    performanceMonitor.record({
      name: 'test_metric',
      value: 100,
      unit: 'ms'
    });

    const metrics = performanceMonitor.getMetrics('test_metric');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].value).toBe(100);
  });

  it('should record Web Vitals', () => {
    performanceMonitor.recordWebVitals({
      LCP: 2000,
      FID: 50,
      CLS: 0.05
    });

    expect(performanceMonitor.getMetrics('web_vitals_lcp')).toHaveLength(1);
    expect(performanceMonitor.getMetrics('web_vitals_fid')).toHaveLength(1);
    expect(performanceMonitor.getMetrics('web_vitals_cls')).toHaveLength(1);
  });

  it('should calculate statistics', () => {
    for (let i = 1; i <= 10; i++) {
      performanceMonitor.record({
        name: 'test_metric',
        value: i * 10,
        unit: 'ms'
      });
    }

    const stats = performanceMonitor.getStats('test_metric');
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(10);
    expect(stats!.min).toBe(10);
    expect(stats!.max).toBe(100);
    expect(stats!.avg).toBe(55);
  });

  it('should filter metrics by time', () => {
    const now = Date.now();

    performanceMonitor.record({
      name: 'test_metric',
      value: 100,
      unit: 'ms'
    });

    const metrics = performanceMonitor.getMetrics('test_metric', now - 1000);
    expect(metrics).toHaveLength(1);

    const futureMetrics = performanceMonitor.getMetrics('test_metric', now + 1000);
    expect(futureMetrics).toHaveLength(0);
  });

  it('should notify subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = performanceMonitor.subscribe(listener);

    performanceMonitor.record({
      name: 'test_metric',
      value: 100,
      unit: 'ms'
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test_metric',
        value: 100
      })
    );

    unsubscribe();
  });
});

describe('AlertingService', () => {
  let service: AlertingService;

  beforeEach(() => {
    service = new AlertingService({
      rules: [
        {
          name: 'test_alert',
          metricName: 'test_metric',
          condition: 'above',
          threshold: 100,
          severity: 'warning',
          message: 'Test metric exceeded threshold',
          enabled: true
        }
      ],
      cooldownMs: 1000
    });
  });

  afterEach(() => {
    service.destroy();
  });

  it('should trigger alert when threshold exceeded', async () => {
    const alertPromise = new Promise<void>((resolve) => {
      service.subscribe((alert) => {
        expect(alert.name).toBe('test_alert');
        expect(alert.severity).toBe('warning');
        resolve();
      });
    });

    performanceMonitor.record({
      name: 'test_metric',
      value: 150,
      unit: 'ms'
    });

    await alertPromise;
  });

  it('should not trigger alert when below threshold', () => {
    const listener = vi.fn();
    service.subscribe(listener);

    performanceMonitor.record({
      name: 'test_metric',
      value: 50,
      unit: 'ms'
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('should respect cooldown period', async () => {
    let alertCount = 0;

    service.subscribe(() => {
      alertCount++;
    });

    performanceMonitor.record({
      name: 'test_metric',
      value: 150,
      unit: 'ms'
    });

    // Immediate second alert should be blocked by cooldown
    performanceMonitor.record({
      name: 'test_metric',
      value: 150,
      unit: 'ms'
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(alertCount).toBe(1);
  });

  it('should resolve alerts', () => {
    const alert = service.createAlert('test', 'info', 'Test message');
    expect(alert.resolved).toBe(false);

    const resolved = service.resolveAlert(alert.id);
    expect(resolved).toBe(true);

    const alerts = service.getAlerts({ resolved: true });
    expect(alerts[0].resolved).toBe(true);
  });

  it('should filter alerts by severity', () => {
    service.createAlert('test1', 'warning', 'Warning message');
    service.createAlert('test2', 'error', 'Error message');
    service.createAlert('test3', 'critical', 'Critical message');

    const warnings = service.getAlerts({ severity: 'warning' });
    expect(warnings).toHaveLength(1);

    const errors = service.getAlerts({ severity: 'error' });
    expect(errors).toHaveLength(1);
  });
});

describe('HealthCheckService', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    service = new HealthCheckService();
  });

  afterEach(() => {
    service.destroy();
  });

  it('should register and run health checks', async () => {
    service.register('test_service', async () => ({
      status: 'healthy',
      message: 'Service is healthy'
    }));

    const result = await service.checkAll();
    expect(result.status).toBe('healthy');
    expect(result.checks.test_service.status).toBe('healthy');
  });

  it('should detect unhealthy services', async () => {
    service.register('healthy_service', async () => ({
      status: 'healthy'
    }));

    service.register('unhealthy_service', async () => ({
      status: 'unhealthy',
      message: 'Service is down'
    }));

    const result = await service.checkAll();
    expect(result.status).toBe('unhealthy');
  });

  it('should detect degraded services', async () => {
    service.register('healthy_service', async () => ({
      status: 'healthy'
    }));

    service.register('degraded_service', async () => ({
      status: 'degraded',
      message: 'Service is slow'
    }));

    const result = await service.checkAll();
    expect(result.status).toBe('degraded');
  });

  it('should handle check timeouts', async () => {
    service.register('slow_service', async () => {
      await new Promise(resolve => setTimeout(resolve, 10000));
      return { status: 'healthy' };
    });

    const result = await service.checkAll();
    expect(result.checks.slow_service.status).toBe('unhealthy');
  }, 10000); // 10 second timeout for this test

  it('should cache last results', async () => {
    service.register('test_service', async () => ({
      status: 'healthy'
    }));

    await service.checkAll();
    const cached = service.getLastResults();

    expect(cached.checks.test_service).toBeDefined();
    expect(cached.checks.test_service.status).toBe('healthy');
  });
});

describe('ErrorTracker', () => {
  beforeEach(() => {
    errorTracker.clear();
  });

  it('should capture errors', () => {
    const error = new Error('Test error');
    const report = errorTracker.captureError(error, 'backend', 'high');

    expect(report.message).toBe('Test error');
    expect(report.context).toBe('backend');
    expect(report.severity).toBe('high');
  });

  it('should capture exceptions with auto-severity', () => {
    const typeError = new TypeError('Type error');
    const report = errorTracker.captureException(typeError, 'frontend');

    expect(report.severity).toBe('high');
  });

  it('should filter errors by context', () => {
    errorTracker.captureError('Frontend error', 'frontend', 'low');
    errorTracker.captureError('Backend error', 'backend', 'high');

    const frontendErrors = errorTracker.getErrors({ context: 'frontend' });
    expect(frontendErrors).toHaveLength(1);

    const backendErrors = errorTracker.getErrors({ context: 'backend' });
    expect(backendErrors).toHaveLength(1);
  });

  it('should provide error statistics', () => {
    errorTracker.captureError('Error 1', 'frontend', 'low');
    errorTracker.captureError('Error 2', 'backend', 'high');
    errorTracker.captureError('Error 3', 'frontend', 'medium');

    const stats = errorTracker.getStats();
    expect(stats.total).toBe(3);
    expect(stats.byContext.frontend).toBe(2);
    expect(stats.byContext.backend).toBe(1);
  });
});

describe('CircuitBreaker', () => {
  it('should execute operation when closed', async () => {
    const breaker = new CircuitBreaker(3, 5000);
    const operation = vi.fn().mockResolvedValue('success');

    const result = await breaker.execute(operation);
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should open after threshold failures', async () => {
    const breaker = new CircuitBreaker(3, 5000);
    const operation = vi.fn().mockRejectedValue(new Error('Failed'));
    const fallback = vi.fn().mockResolvedValue('fallback');

    // Trigger failures
    for (let i = 0; i < 3; i++) {
      await breaker.execute(operation, fallback).catch(() => {});
    }

    const state = breaker.getState();
    expect(state.state).toBe('open');

    // Should use fallback when open
    const result = await breaker.execute(operation, fallback);
    expect(result).toBe('fallback');
  });
});

describe('retryWithBackoff', () => {
  it('should retry failed operations', async () => {
    let attempts = 0;
    const operation = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Failed');
      }
      return Promise.resolve('success');
    });

    const result = await retryWithBackoff(operation, 3, 10);
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should throw after max retries', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Failed'));

    await expect(retryWithBackoff(operation, 2, 10)).rejects.toThrow('Failed');
    expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});

describe('DegradationCache', () => {
  it('should store and retrieve values', () => {
    const cache = new DegradationCache<string>();
    cache.set('key1', 'value1', 1000);

    expect(cache.get('key1')).toBe('value1');
    expect(cache.has('key1')).toBe(true);
  });

  it('should expire values after TTL', async () => {
    const cache = new DegradationCache<string>();
    cache.set('key1', 'value1', 100);

    expect(cache.get('key1')).toBe('value1');

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(cache.get('key1')).toBeUndefined();
    expect(cache.has('key1')).toBe(false);
  });

  it('should clear all values', () => {
    const cache = new DegradationCache<string>();
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    expect(cache.size()).toBe(2);

    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
