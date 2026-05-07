/**
 * Fear & Greed Index Provider
 *
 * Fetches cryptocurrency market sentiment from Alternative.me
 * https://alternative.me/crypto/fear-and-greed-index/
 */

import axios, { AxiosInstance } from 'axios';
import type { FearGreedIndex, SentimentProvider } from '../types';

export interface FearGreedConfig {
  baseURL?: string;
  cacheTTL?: number; // Cache TTL in seconds
}

interface FearGreedResponse {
  name: string;
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update?: string;
  }>;
  metadata: {
    error: null | string;
  };
}

export class FearGreedProvider implements SentimentProvider {
  name = 'FearGreed';
  private client: AxiosInstance;
  private connected = false;
  private cache: {
    data: FearGreedIndex | null;
    timestamp: number;
  } = {
    data: null,
    timestamp: 0,
  };
  private cacheTTL: number;

  constructor(config: FearGreedConfig = {}) {
    this.client = axios.create({
      baseURL: config.baseURL || 'https://api.alternative.me',
      timeout: 10000,
    });
    this.cacheTTL = (config.cacheTTL || 300) * 1000; // Convert to milliseconds
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    try {
      // Test connection
      await this.client.get('/fng/');
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to Fear & Greed API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.cache = { data: null, timestamp: 0 };
  }

  /**
   * Get current Fear & Greed Index
   */
  async getCurrentIndex(): Promise<FearGreedIndex> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }

    // Check cache
    const now = Date.now();
    if (this.cache.data && (now - this.cache.timestamp) < this.cacheTTL) {
      return this.cache.data;
    }

    try {
      const response = await this.client.get<FearGreedResponse>('/fng/', {
        params: { limit: 1 },
      });

      if (response.data.metadata.error) {
        throw new Error(response.data.metadata.error);
      }

      const data = response.data.data[0];
      const index = this.mapIndex(data);

      // Update cache
      this.cache = {
        data: index,
        timestamp: now,
      };

      return index;
    } catch (error) {
      throw new Error(`Failed to fetch Fear & Greed Index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get historical Fear & Greed Index
   */
  async getHistoricalIndex(limit: number = 30): Promise<FearGreedIndex[]> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }

    try {
      const response = await this.client.get<FearGreedResponse>('/fng/', {
        params: { limit },
      });

      if (response.data.metadata.error) {
        throw new Error(response.data.metadata.error);
      }

      return response.data.data.map(data => this.mapIndex(data));
    } catch (error) {
      throw new Error(`Failed to fetch historical Fear & Greed Index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get Fear & Greed Index for a specific date
   */
  async getIndexByDate(date: Date): Promise<FearGreedIndex | null> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }

    try {
      const timestamp = Math.floor(date.getTime() / 1000);
      const response = await this.client.get<FearGreedResponse>('/fng/', {
        params: { limit: 1, date_format: 'us' },
      });

      if (response.data.metadata.error) {
        throw new Error(response.data.metadata.error);
      }

      // API doesn't support exact date queries, so we fetch recent data
      // and find the closest match
      const historical = await this.getHistoricalIndex(30);
      const closest = historical.reduce((prev, curr) => {
        const prevDiff = Math.abs(prev.timestamp.getTime() - date.getTime());
        const currDiff = Math.abs(curr.timestamp.getTime() - date.getTime());
        return currDiff < prevDiff ? curr : prev;
      });

      return closest;
    } catch (error) {
      throw new Error(`Failed to fetch Fear & Greed Index by date: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map API response to internal format
   */
  private mapIndex(data: FearGreedResponse['data'][0]): FearGreedIndex {
    const value = parseInt(data.value, 10);
    const classification = this.classifyValue(value);

    return {
      value,
      classification,
      timestamp: new Date(parseInt(data.timestamp, 10) * 1000),
    };
  }

  /**
   * Classify Fear & Greed value
   */
  private classifyValue(value: number): FearGreedIndex['classification'] {
    if (value <= 20) return 'EXTREME_FEAR';
    if (value <= 40) return 'FEAR';
    if (value <= 60) return 'NEUTRAL';
    if (value <= 80) return 'GREED';
    return 'EXTREME_GREED';
  }

  /**
   * Convert Fear & Greed Index to sentiment score (-1 to 1)
   */
  static toSentimentScore(index: FearGreedIndex): number {
    // Map 0-100 to -1 to 1
    // 0 (extreme fear) = -1
    // 50 (neutral) = 0
    // 100 (extreme greed) = 1
    return (index.value - 50) / 50;
  }
}
