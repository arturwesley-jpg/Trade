import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SentimentService } from '../sentiment.service';
import type { NewsArticle, FearGreedIndex } from '../types';

// Mock the providers
vi.mock('../providers/cryptopanic.provider', () => ({
  CryptoPanicProvider: vi.fn().mockImplementation(() => ({
    getNews: vi.fn().mockResolvedValue([
      {
        id: '1',
        title: 'Bitcoin reaches new highs',
        url: 'https://example.com/1',
        publishedAt: new Date(),
        source: 'CryptoNews',
        sentiment: 0.8,
        currencies: ['BTC'],
      },
    ]),
    getBullishNews: vi.fn().mockResolvedValue([]),
    getBearishNews: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../providers/fear-greed.provider', () => ({
  FearGreedProvider: vi.fn().mockImplementation(() => ({
    getCurrentIndex: vi.fn().mockResolvedValue({
      value: 75,
      classification: 'GREED',
      timestamp: new Date(),
    }),
    getHistoricalData: vi.fn().mockResolvedValue([]),
  })),
}));

describe('SentimentService', () => {
  let service: SentimentService;

  beforeEach(() => {
    service = new SentimentService({
      cryptoPanicApiKey: 'test-api-key',
    });
  });

  describe('getSentiment', () => {
    it('should aggregate sentiment from multiple sources', async () => {
      const sentiment = await service.getSentiment('BTC-USDT');

      expect(sentiment).toBeDefined();
      expect(sentiment.symbol).toBe('BTC-USDT');
      expect(sentiment.overallScore).toBeGreaterThanOrEqual(-1);
      expect(sentiment.overallScore).toBeLessThanOrEqual(1);
      expect(sentiment.sentiment).toMatch(/BULLISH|BEARISH|NEUTRAL|VERY_BULLISH|VERY_BEARISH/);
      expect(sentiment.confidence).toBeGreaterThan(0);
      expect(sentiment.confidence).toBeLessThanOrEqual(100);
    });

    it('should include component breakdown', async () => {
      const sentiment = await service.getSentiment('BTC-USDT');

      expect(sentiment.components).toBeDefined();
      expect(sentiment.components.news).toBeDefined();
      expect(sentiment.components.fearGreed).toBeDefined();
    });
  });

  describe('getSentimentBatch', () => {
    it('should get sentiment for multiple symbols', async () => {
      const symbols = ['BTC-USDT', 'ETH-USDT'];
      const results = await service.getSentimentBatch(symbols);

      expect(results.size).toBe(2);
      expect(results.has('BTC-USDT')).toBe(true);
      expect(results.has('ETH-USDT')).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const symbols = ['INVALID-SYMBOL'];
      const results = await service.getSentimentBatch(symbols);

      expect(results.size).toBeLessThanOrEqual(1);
    });
  });

  describe('getNews', () => {
    it('should fetch news for a symbol', async () => {
      const news = await service.getNews('BTC', 10);

      expect(Array.isArray(news)).toBe(true);
      // Mock may return empty array
      if (news.length > 0) {
        expect(news[0]).toHaveProperty('title');
        expect(news[0]).toHaveProperty('sentiment');
      }
    });
  });

  describe('getFearGreedIndex', () => {
    it('should fetch current Fear & Greed Index', async () => {
      const index = await service.getFearGreedIndex();

      expect(index).toBeDefined();
      expect(index?.value).toBeGreaterThanOrEqual(0);
      expect(index?.value).toBeLessThanOrEqual(100);
      expect(index?.classification).toMatch(/EXTREME_FEAR|FEAR|NEUTRAL|GREED|EXTREME_GREED/);
    });
  });

  describe('getHistoricalFearGreed', () => {
    it('should fetch historical Fear & Greed data', async () => {
      const history = await service.getHistoricalFearGreed(7);

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('getBullishNews', () => {
    it('should filter bullish news', async () => {
      const news = await service.getBullishNews(['BTC'], 5);

      expect(Array.isArray(news)).toBe(true);
    });
  });

  describe('getBearishNews', () => {
    it('should filter bearish news', async () => {
      const news = await service.getBearishNews(['BTC'], 5);

      expect(Array.isArray(news)).toBe(true);
    });
  });
});
