/**
 * Sentiment Service
 *
 * Orchestrates sentiment data collection and aggregation.
 */

import type {
  NewsArticle,
  FearGreedIndex,
  SocialSentiment,
  WhaleActivity,
  AggregatedSentiment,
} from './types.js';
import { CryptoPanicProvider } from './providers/cryptopanic.provider.js';
import { FearGreedProvider } from './providers/fear-greed.provider.js';
import { SentimentAggregator } from './aggregator/sentiment-aggregator.js';

export interface SentimentServiceConfig {
  cryptoPanicApiKey?: string;
  aggregatorConfig?: ConstructorParameters<typeof SentimentAggregator>[0];
}

export class SentimentService {
  private cryptoPanic?: CryptoPanicProvider;
  private fearGreed: FearGreedProvider;
  private aggregator: SentimentAggregator;

  constructor(config: SentimentServiceConfig = {}) {
    if (config.cryptoPanicApiKey) {
      this.cryptoPanic = new CryptoPanicProvider({
        apiKey: config.cryptoPanicApiKey,
      });
    }

    this.fearGreed = new FearGreedProvider();
    this.aggregator = new SentimentAggregator(config.aggregatorConfig);
  }

  /**
   * Initialize all providers
   */
  async connect(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.cryptoPanic) {
      promises.push(this.cryptoPanic.connect());
    }

    promises.push(this.fearGreed.connect());

    await Promise.all(promises);
  }

  /**
   * Disconnect all providers
   */
  async disconnect(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.cryptoPanic) {
      promises.push(this.cryptoPanic.disconnect());
    }

    promises.push(this.fearGreed.disconnect());

    await Promise.all(promises);
  }

  /**
   * Get aggregated sentiment for a symbol
   */
  async getSentiment(symbol: string): Promise<AggregatedSentiment> {
    const [news, fearGreed] = await Promise.all([
      this.getNews(symbol),
      this.getFearGreedIndex(),
    ]);

    return this.aggregator.aggregate({
      symbol,
      news,
      fearGreed: fearGreed ?? undefined,
      // Social and whale data would be added here when implemented
    });
  }

  /**
   * Get news articles for a symbol
   */
  async getNews(symbol: string, limit: number = 20): Promise<NewsArticle[]> {
    if (!this.cryptoPanic) {
      return [];
    }

    try {
      return await this.cryptoPanic.getNewsBySymbol(symbol, limit);
    } catch (error) {
      console.error(`Failed to fetch news for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get bullish news
   */
  async getBullishNews(currencies?: string[], limit: number = 20): Promise<NewsArticle[]> {
    if (!this.cryptoPanic) {
      return [];
    }

    try {
      return await this.cryptoPanic.getBullishNews(currencies, limit);
    } catch (error) {
      console.error('Failed to fetch bullish news:', error);
      return [];
    }
  }

  /**
   * Get bearish news
   */
  async getBearishNews(currencies?: string[], limit: number = 20): Promise<NewsArticle[]> {
    if (!this.cryptoPanic) {
      return [];
    }

    try {
      return await this.cryptoPanic.getBearishNews(currencies, limit);
    } catch (error) {
      console.error('Failed to fetch bearish news:', error);
      return [];
    }
  }

  /**
   * Get current Fear & Greed Index
   */
  async getFearGreedIndex(): Promise<FearGreedIndex | null> {
    try {
      return await this.fearGreed.getCurrentIndex();
    } catch (error) {
      console.error('Failed to fetch Fear & Greed Index:', error);
      return null;
    }
  }

  /**
   * Get historical Fear & Greed Index
   */
  async getHistoricalFearGreed(limit: number = 30): Promise<FearGreedIndex[]> {
    try {
      return await this.fearGreed.getHistoricalIndex(limit);
    } catch (error) {
      console.error('Failed to fetch historical Fear & Greed Index:', error);
      return [];
    }
  }

  /**
   * Batch get sentiment for multiple symbols
   */
  async getSentimentBatch(symbols: string[]): Promise<Map<string, AggregatedSentiment>> {
    const results = new Map<string, AggregatedSentiment>();

    // Get Fear & Greed once (applies to all symbols)
    const fearGreed = await this.getFearGreedIndex();

    // Get sentiment for each symbol
    await Promise.all(
      symbols.map(async symbol => {
        try {
          const news = await this.getNews(symbol);
          const sentiment = this.aggregator.aggregate({
            symbol,
            news,
            fearGreed: fearGreed ?? undefined,
          });
          results.set(symbol, sentiment);
        } catch (error) {
          console.error(`Failed to get sentiment for ${symbol}:`, error);
        }
      })
    );

    return results;
  }
}
