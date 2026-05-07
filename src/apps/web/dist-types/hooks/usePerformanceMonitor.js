/**
 * Frontend Performance Monitoring Hook
 * Tracks Web Vitals and user interactions
 */
import { useEffect, useRef } from 'react';
import { performanceMonitor } from '@trade/shared';
/**
 * Hook to monitor frontend performance
 */
export function usePerformanceMonitor(options = {}) {
    const { trackWebVitals = true, trackNavigation = true, trackResources = false } = options;
    useEffect(() => {
        if (!trackWebVitals)
            return;
        // Track Web Vitals using PerformanceObserver
        const observeWebVitals = () => {
            // Largest Contentful Paint (LCP)
            if ('PerformanceObserver' in window) {
                try {
                    const lcpObserver = new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        const lastEntry = entries[entries.length - 1];
                        if (lastEntry) {
                            performanceMonitor.recordWebVitals({
                                LCP: lastEntry.renderTime || lastEntry.loadTime
                            });
                        }
                    });
                    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                    // First Input Delay (FID)
                    const fidObserver = new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        entries.forEach((entry) => {
                            performanceMonitor.recordWebVitals({
                                FID: entry.processingStart - entry.startTime
                            });
                        });
                    });
                    fidObserver.observe({ entryTypes: ['first-input'] });
                    // Cumulative Layout Shift (CLS)
                    let clsValue = 0;
                    const clsObserver = new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        entries.forEach((entry) => {
                            if (!entry.hadRecentInput) {
                                clsValue += entry.value;
                                performanceMonitor.recordWebVitals({
                                    CLS: clsValue
                                });
                            }
                        });
                    });
                    clsObserver.observe({ entryTypes: ['layout-shift'] });
                    return () => {
                        lcpObserver.disconnect();
                        fidObserver.disconnect();
                        clsObserver.disconnect();
                    };
                }
                catch (error) {
                    console.warn('PerformanceObserver not fully supported:', error);
                }
            }
        };
        const cleanup = observeWebVitals();
        return cleanup;
    }, [trackWebVitals]);
    useEffect(() => {
        if (!trackNavigation)
            return;
        // Track navigation timing
        const recordNavigationTiming = () => {
            if ('performance' in window && 'getEntriesByType' in performance) {
                const navEntries = performance.getEntriesByType('navigation');
                if (navEntries.length > 0) {
                    const nav = navEntries[0];
                    // First Contentful Paint
                    const paintEntries = performance.getEntriesByType('paint');
                    const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');
                    if (fcp) {
                        performanceMonitor.recordWebVitals({
                            FCP: fcp.startTime
                        });
                    }
                    // Time to First Byte
                    performanceMonitor.recordWebVitals({
                        TTFB: nav.responseStart - nav.requestStart
                    });
                    // Time to Interactive (approximation)
                    performanceMonitor.recordWebVitals({
                        TTI: nav.domInteractive - nav.fetchStart
                    });
                }
            }
        };
        // Wait for page load
        if (document.readyState === 'complete') {
            recordNavigationTiming();
        }
        else {
            window.addEventListener('load', recordNavigationTiming);
            return () => window.removeEventListener('load', recordNavigationTiming);
        }
    }, [trackNavigation]);
    useEffect(() => {
        if (!trackResources)
            return;
        // Track resource loading
        const observeResources = () => {
            if ('PerformanceObserver' in window) {
                try {
                    const resourceObserver = new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        entries.forEach((entry) => {
                            if (entry.duration > 1000) { // Only track slow resources
                                performanceMonitor.record({
                                    name: 'resource_load_time',
                                    value: entry.duration,
                                    unit: 'ms',
                                    tags: {
                                        type: entry.initiatorType,
                                        name: entry.name
                                    }
                                });
                            }
                        });
                    });
                    resourceObserver.observe({ entryTypes: ['resource'] });
                    return () => resourceObserver.disconnect();
                }
                catch (error) {
                    console.warn('Resource observer not supported:', error);
                }
            }
        };
        const cleanup = observeResources();
        return cleanup;
    }, [trackResources]);
}
/**
 * Hook to track API call performance
 */
export function useAPIPerformanceTracking() {
    const trackAPICall = (endpoint, method, statusCode, duration, error) => {
        performanceMonitor.recordAPICall({
            endpoint,
            method,
            statusCode,
            duration,
            timestamp: Date.now(),
            error
        });
    };
    return { trackAPICall };
}
/**
 * Hook to track component render performance
 */
export function useRenderPerformance(componentName) {
    const renderCount = useRef(0);
    const mountTime = useRef(Date.now());
    useEffect(() => {
        renderCount.current += 1;
        const renderTime = Date.now() - mountTime.current;
        if (renderCount.current === 1) {
            // First render (mount)
            performanceMonitor.record({
                name: 'component_mount_time',
                value: renderTime,
                unit: 'ms',
                tags: { component: componentName }
            });
        }
        else {
            // Re-render
            performanceMonitor.record({
                name: 'component_render_time',
                value: renderTime,
                unit: 'ms',
                tags: {
                    component: componentName,
                    renderCount: renderCount.current.toString()
                }
            });
        }
        mountTime.current = Date.now();
    });
    return {
        renderCount: renderCount.current
    };
}
/**
 * Hook to track user interactions
 */
export function useInteractionTracking() {
    const trackInteraction = (action, target, metadata) => {
        performanceMonitor.record({
            name: 'user_interaction',
            value: 1,
            unit: 'count',
            tags: {
                action,
                target,
                ...metadata
            }
        });
    };
    return { trackInteraction };
}
