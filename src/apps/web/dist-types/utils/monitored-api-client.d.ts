/**
 * API Client with Performance Tracking
 * Wraps fetch calls to automatically track performance
 */
export interface FetchOptions extends RequestInit {
    timeout?: number;
}
/**
 * Enhanced fetch with performance tracking
 */
export declare function trackedFetch(url: string, options?: FetchOptions): Promise<Response>;
/**
 * API client class with built-in performance tracking
 */
export declare class MonitoredAPIClient {
    private baseURL;
    private defaultHeaders;
    constructor(baseURL: string, defaultHeaders?: Record<string, string>);
    private request;
    get<T>(endpoint: string, options?: FetchOptions): Promise<T>;
    post<T>(endpoint: string, data?: any, options?: FetchOptions): Promise<T>;
    put<T>(endpoint: string, data?: any, options?: FetchOptions): Promise<T>;
    delete<T>(endpoint: string, options?: FetchOptions): Promise<T>;
    setAuthToken(token: string): void;
    clearAuthToken(): void;
}
/**
 * Create a monitored API client instance
 */
export declare function createMonitoredAPIClient(baseURL: string, defaultHeaders?: Record<string, string>): MonitoredAPIClient;
