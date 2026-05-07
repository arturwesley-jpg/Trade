import { describe, it, expect, beforeEach } from 'vitest';
import { SentimentAggregator } from '../aggregator/sentiment-aggregator';
import type { NewsArticle, FearGreedIndex, SocialSentiment, WhaleActivity } from '../types';

describe('SentimentAggregator', () => {
  let aggregator: SentimentAggregator;

  beforeEach(() => {
    aggregator = new SentimentAggregator({
      weights: {
        news: 1.2,
        fearGreed: 1.5,
        social: 1.0,
        whales: 1.3,
      },
    });
  });

  describe('aggregate', () => {
    it('should aggregate sentiment from multiple sources', () => {
      const news: NewsArticle[] = [
        {
          id: '1',
          title: 'Bitcoin surges to new highs',
          url: 'https://example.com/1',
          publishedAt: new Date(),
          source: 'CryptoNews',
          sentiment: 'VERY_BULLISH',
          currencies: ['BTC'],
        },
        {
          id: '2',
          title: 'Market shows strong momentum',
          url: 'https://example.com/2',
          publishedAt: new Date(Date.now() - 3600000), // 1 hour ago
          source: 'CryptoNews',
          sentiment: 'BULLISH',
          currencies: ['BTC'],
        },
      ];

      const fearGreed: FearGreedIndex = {
        value: 75,
        classification: 'GREED',
        timestamp: new Date(),
      };

      const result = aggregator.aggregate({
        symbol: 'BTC-USDT',
        news,
        fearGreed,
      });

      expect(result.symbol).toBe('BTC-USDT');
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
      expect(['BULLISH', 'VERY_BULLISH']).toContain(result.sentiment);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
      expect(result.components.news).toBeDefined();
      expect(result.components.fearGreed).toBeDefined();
    });

    it('should handle missing news data', () => {
      const fearGreed: FearGreedIndex = {
        value: 50,
        classification: 'NEUTRAL',
        timestamp: new Date(),
      };

      const result = aggregator.aggregate({
        symbol: 'BTC-USDT',
        fearGreed,
      });

      expect(result.symbol).toBe('BTC-USDT');
      expect(result.sentiment).toBe('NEUTRAL');
      expect(result.components.news?.count).toBe(0);
      expect(result.components.fearGreed).toBeDefined();
    });

    it('should classify sentiment correctly', () => {
      const bullishNews: NewsArticle[] = [
        {
          id: '1',
          title: 'Very bullish news',
          url: 'https://example.com/1',
          publishedAt: new Date(),
          source: 'CryptoNews',
          sentiment: 'VERY_BULLISH',
          currencies: ['BTC'],
        },
      ];

      const bearishNews: NewsArticle[] = [
        {
          id: '2',
          title: 'Very bearish news',
          url: 'https://example.com/2',
          publishedAt: new Date(),
          source: 'CryptoNews',
          sentiment: 'VERY_BEARISH',
          currencies: ['BTC'],
        },
      ];

      const bullishResult = aggregator.aggregate({
        symbol: 'BTC-USDT',
        news: bullishNews,
      });

      const bearishResult = aggregator.aggregate({
        symbol: 'BTC-USDT',
        news: bearishNews,
      });

      expect(['BULLISH', 'VERY_BULLISH']).toContain(bullishResult.sentiment);
      expect(['BEARISH', 'VERY_BEARISH']).toContain(bearishResult.sentiment);
    });

    it('should apply time decay to news articles', () => {
      const recentNews: NewsArticle = {
        id: '1',
        title: 'Recent news',
        url: 'https://example.com/1',
        publishedAt: new Date(),
        source: 'CryptoNews',
        sentiment: 'VERY_BULLISH',
        currencies: ['BTC'],
      };

      const oldNews: NewsArticle = {
        id: '2',
        title: 'Old news',
        url: 'https://example.com/2',
        publishedAt: new Date(Date.now() - 20 * 3600000), // 20 hours ago
        source: 'CryptoNews',
        sentiment: 'VERY_BULLISH',
        currencies: ['BTC'],
      };

      const recentResult = aggregator.aggregate({
        symbol: 'BTC-USDT',
        news: [recentNews],
      });

      const oldResult = aggregator.aggregate({
        symbol: 'BTC-USDT',
        news: [oldNews],
      });

      // Recent news should have higher impact
      expect(recentResult.overallScore).toBeGreaterThan(oldResult.overallScore);
    });

    it('should calculate confidence based on data availability', () => {
      const singleSource = aggregator.aggregate({
        symbol: 'BTC-USDT',
        news: [
          {
            id: '1',
            title: 'News',
            url: 'https://example.com/1',
            publishedAt: new Date(),
            source: 'CryptoNews',
            sentiment: 'NEUTRAL',
            currencies: ['BTC'],
          },
        ],
      });

      const multiSource = aggregator.aggregate({
        symbol: 'BTC-USDT',
        news: [
          {
            id: '1',
            title: 'News',
            url: 'https://example.com/1',
            publishedAt: new Date(),
            source: 'CryptoNews',
            sentiment: 'NEUTRAL',
            currencies: ['BTC'],
          },
        ],
        fearGreed: {
          value: 50,
          classification: 'NEUTRAL',
          timestamp: new Date(),
        },
      });

      // More data sources should increase confidence
      expect(multiSource.confidence).toBeGreaterThan(singleSource.confidence);
    });

    it('should handle whale activity', () => {
      const whaleActivity: WhaleActivity[] = [
        {
          type: 'WHALE_ACCUMULATION',
          amount: 1000000,
          amountUSD: 100000000,
          symbol: 'BTC',
          txHash: '0x123',
          timestamp: new Date(),
          significance: 'HIGH',
        },
      ];

      const result = aggregator.aggregate({
        symbol: 'BTC-USDT',
        whales: whaleActivity,
      });

      expect(result.components.whales).toBeDefined();
      if (result.components.whales) {
        expect(result.components.whales.score).toBeGreaterThan(0);
      }
    });
  });
});
