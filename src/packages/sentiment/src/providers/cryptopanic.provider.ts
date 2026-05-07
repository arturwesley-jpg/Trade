/**
 * CryptoPanic News Provider
 *
 * Fetches cryptocurrency news from CryptoPanic API
 * https://cryptopanic.com/developers/api/
 */

import axios, { AxiosInstance } from 'axios';
import type { NewsArticle, SentimentScore, SentimentProvider } from '../types';

export interface CryptoPanicConfig {
  apiKey: string;
  baseURL?: string;
}

interface CryptoPanicResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CryptoPanicArticle[];
}

interface CryptoPanicArticle {
  id: number;
  title: string;
  body?: string;
  url: string;
  source: {
    title: string;
    domain: string;
  };
  published_at: string;
  currencies?: Array<{
    code: string;
    title: string;
  }>;
  votes?: {
    positive: number;
    negative: number;
    important: number;
  };
  kind: 'news' | 'media';
}

export class CryptoPanicProvider implements SentimentProvider {
  name = 'CryptoPanic';
  private client: AxiosInstance;
  private connected = false;

  constructor(private config: CryptoPanicConfig) {
    this.client = axios.create({
      baseURL: config.baseURL || 'https://cryptopanic.com/api/v1',
      timeout: 10000,
      params: {
        auth_token: config.apiKey,
      },
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    try {
      // Test connection with a simple request
      await this.client.get('/posts/', {
        params: { filter: 'hot', public: 'true' },
      });
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to CryptoPanic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Fetch recent news articles
   */
  async getNews(options: {
    currencies?: string[];
    filter?: 'rising' | 'hot' | 'bullish' | 'bearish' | 'important' | 'saved' | 'lol';
    kind?: 'news' | 'media' | 'all';
    limit?: number;
  } = {}): Promise<NewsArticle[]> {
    if (!this.connected) {
      throw new Error('Provider not connected');
    }

    try {
      const params: any = {
        public: 'true',
      };

      if (options.currencies && options.currencies.length > 0) {
        params.currencies = options.currencies.join(',');
      }

      if (options.filter) {
        params.filter = options.filter;
      }

      if (options.kind && options.kind !== 'all') {
        params.kind = options.kind;
      }

      const response = await this.client.get<CryptoPanicResponse>('/posts/', { params });

      let articles = response.data.results.map(article => this.mapArticle(article));

      if (options.limit) {
        articles = articles.slice(0, options.limit);
      }

      return articles;
    } catch (error) {
      throw new Error(`Failed to fetch news: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch news for a specific symbol
   */
  async getNewsBySymbol(symbol: string, limit: number = 20): Promise<NewsArticle[]> {
    return this.getNews({
      currencies: [symbol.replace('USDT', '').replace('USD', '')],
      limit,
    });
  }

  /**
   * Fetch bullish news
   */
  async getBullishNews(currencies?: string[], limit: number = 20): Promise<NewsArticle[]> {
    return this.getNews({
      currencies,
      filter: 'bullish',
      limit,
    });
  }

  /**
   * Fetch bearish news
   */
  async getBearishNews(currencies?: string[], limit: number = 20): Promise<NewsArticle[]> {
    return this.getNews({
      currencies,
      filter: 'bearish',
      limit,
    });
  }

  /**
   * Calculate sentiment score from article votes
   */
  private calculateSentiment(votes?: { positive: number; negative: number }): SentimentScore {
    if (!votes || (votes.positive === 0 && votes.negative === 0)) {
      return 'NEUTRAL';
    }

    const total = votes.positive + votes.negative;
    const ratio = votes.positive / total;

    if (ratio >= 0.8) return 'VERY_BULLISH';
    if (ratio >= 0.6) return 'BULLISH';
    if (ratio >= 0.4) return 'NEUTRAL';
    if (ratio >= 0.2) return 'BEARISH';
    return 'VERY_BEARISH';
  }

  /**
   * Map CryptoPanic article to internal format
   */
  private mapArticle(article: CryptoPanicArticle): NewsArticle {
    return {
      id: `cryptopanic-${article.id}`,
      title: article.title,
      body: article.body,
      url: article.url,
      source: article.source.title,
      publishedAt: new Date(article.published_at),
      sentiment: this.calculateSentiment(article.votes),
      currencies: article.currencies?.map(c => c.code),
      votes: article.votes,
    };
  }
}
