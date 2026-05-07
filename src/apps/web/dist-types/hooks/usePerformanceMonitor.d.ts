/**
 * Frontend Performance Monitoring Hook
 * Tracks Web Vitals and user interactions
 */
export interface UsePerformanceMonitorOptions {
    trackWebVitals?: boolean;
    trackNavigation?: boolean;
    trackResources?: boolean;
}
/**
 * Hook to monitor frontend performance
 */
export declare function usePerformanceMonitor(options?: UsePerformanceMonitorOptions): void;
/**
 * Hook to track API call performance
 */
export declare function useAPIPerformanceTracking(): {
    trackAPICall: (endpoint: string, method: string, statusCode: number, duration: number, error?: string) => void;
};
/**
 * Hook to track component render performance
 */
export declare function useRenderPerformance(componentName: string): {
    renderCount: number;
};
/**
 * Hook to track user interactions
 */
export declare function useInteractionTracking(): {
    trackInteraction: (action: string, target: string, metadata?: Record<string, string>) => void;
};
