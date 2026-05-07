/**
 * API Client with Performance Tracking
 * Wraps fetch calls to automatically track performance
 */

import { performanceMonitor } from '@trade/shared';

export interface FetchOptions extends RequestInit {
  timeout?: number;
}

/**
 * Enhanced fetch with performance tracking
 */
export async function trackedFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const startTime = Date.now();
  const { timeout = 30000, ...fetchOptions } = options;

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;

    // Track performance
    performanceMonitor.recordAPICall({
      endpoint: url,
      method: options.method || 'GET',
      statusCode: response.status,
      duration,
      timestamp: Date.now(),
      error: response.ok ? undefined : 'HTTP error'
    });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Track error
    performanceMonitor.recordAPICall({
      endpoint: url,
      method: options.method || 'GET',
      statusCode: 0,
      duration,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    throw error;
  }
}

/**
 * API client class with built-in performance tracking
 */
export class MonitoredAPIClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = defaultHeaders;
  }

  private async request<T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      ...this.defaultHeaders,
      ...options.headers
    };

    const response = await trackedFetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options?: FetchOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: JSON.stringify(data)
    });
  }

  async put<T>(endpoint: string, data?: any, options?: FetchOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: JSON.stringify(data)
    });
  }

  async delete<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  setAuthToken(token: string) {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken() {
    delete this.defaultHeaders['Authorization'];
  }
}

/**
 * Create a monitored API client instance
 */
export function createMonitoredAPIClient(
  baseURL: string,
  defaultHeaders?: Record<string, string>
): MonitoredAPIClient {
  return new MonitoredAPIClient(baseURL, defaultHeaders);
}
