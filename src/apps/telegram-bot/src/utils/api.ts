/**
 * Enhanced API Client
 * Handles all API communication with proper error handling
 */

import type {
  HealthResponse,
  Position,
  Trade,
  MarketTick,
  AlertEvent,
  TradingSignal
} from "@trade/shared";

export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async getHealth(): Promise<HealthResponse> {
    return this.fetch<HealthResponse>("/health");
  }

  async getPositions(): Promise<Position[]> {
    return this.fetch<Position[]>("/positions");
  }

  async getTrades(): Promise<Trade[]> {
    return this.fetch<Trade[]>("/trades");
  }

  async getSignals(): Promise<TradingSignal[]> {
    return this.fetch<TradingSignal[]>("/signals");
  }

  async getSignal(symbol: string): Promise<TradingSignal | null> {
    return this.fetch<TradingSignal | null>(`/signals/${encodeURIComponent(symbol)}`);
  }

  async getMarketTicker(symbol?: string): Promise<MarketTick | MarketTick[]> {
    const endpoint = symbol
      ? `/market/ticker?symbol=${encodeURIComponent(symbol)}`
      : "/market/ticker";
    return this.fetch<MarketTick | MarketTick[]>(endpoint);
  }

  async getAlerts(): Promise<AlertEvent[]> {
    return this.fetch<AlertEvent[]>("/alerts");
  }

  async getPaperStatus(): Promise<{
    source: string;
    metrics: any;
    openPositions: number;
  }> {
    return this.fetch("/paper-trading/status");
  }

  async getPaperTrades(): Promise<Trade[]> {
    return this.fetch<Trade[]>("/paper-trading/trades");
  }

  async getMetricsPerformance(): Promise<any> {
    return this.fetch("/metrics/performance");
  }

  async getMetricsRisk(): Promise<any> {
    return this.fetch("/metrics/risk");
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();

      // Extract data field if present
      if (payload.data !== undefined) {
        return payload.data as T;
      }

      return payload as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to fetch ${endpoint}: ${String(error)}`);
    }
  }
}

export function formatApiError(error: unknown): string {
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Unknown error: ${String(error)}`;
}
