import { describe, it, expect, beforeEach } from 'vitest';
import { SignalAggregator } from '../signal-aggregator';
import type { Candle } from '@trade/shared';

describe('SignalAggregator', () => {
  let aggregator: SignalAggregator;

  beforeEach(() => {
    aggregator = new SignalAggregator();
  });

  const createCandles = (count: number, pattern: 'uptrend' | 'downtrend' | 'sideways' = 'sideways'): Candle[] => {
    return Array.from({ length: count }, (_, i) => {
      let price = 100;
      if (pattern === 'uptrend') {
        price = 100 + i * 2;
      } else if (pattern === 'downtrend') {
        price = 200 - i * 2;
      } else {
        price = 100 + Math.sin(i / 10) * 10;
      }

      return {
        symbol: 'BTC-USDT',
        timestamp: new Date(Date.now() - (count - i) * 60000),
        open: price,
        high: price + 5,
        low: price - 5,
        close: price,
        volume: 1000 + Math.sin(i / 5) * 200,
      };
    });
  };

  describe('aggregate', () => {
    it('should return null for insufficient data', () => {
      const candles = createCandles(30);

      const result = aggregator.aggregate(candles);

      expect(result).toBeNull();
    });

    it('should aggregate signals correctly', () => {
      const candles = createCandles(50);

      const result = aggregator.aggregate(candles);

      expect(result).not.toBeNull();
      expect(result!.symbol).toBe('BTC-USDT');
      expect(['BUY', 'SELL', 'NEUTRAL']).toContain(result!.signal);
      expect(result!.confidence).toBeGreaterThanOrEqual(0);
      expect(result!.confidence).toBeLessThanOrEqual(100);
      expect(result!.strength).toBeGreaterThanOrEqual(0);
      expect(result!.strength).toBeLessThanOrEqual(100);
      expect(result!.indicators).toBeDefined();
      expect(typeof result!.explanation).toBe('string');
    });

    it('should detect strong buy signal', () => {
      const candles = createCandles(50, 'uptrend');

      const result = aggregator.aggregate(candles);

      expect(result).not.toBeNull();
      expect(result!.signal).toBe('BUY');
      expect(result!.confidence).toBeGreaterThan(50);
    });

    it('should detect strong sell signal', () => {
      const candles = createCandles(50, 'downtrend');

      const result = aggregator.aggregate(candles);

      expect(result).not.toBeNull();
      expect(result!.signal).toBe('SELL');
      expect(result!.confidence).toBeGreaterThan(50);
    });

    it('should include all indicator results', () => {
      const candles = createCandles(50);

      const result = aggregator.aggregate(candles);

      expect(result).not.toBeNull();
      expect(result!.indicators.rsi).toBeDefined();
      expect(result!.indicators.macd).toBeDefined();
      expect(result!.indicators.bollinger).toBeDefined();
      expect(result!.indicators.stochastic).toBeDefined();
      expect(result!.indicators.obv).toBeDefined();
      expect(result!.indicators.adx).toBeDefined();
      expect(result!.indicators.atr).toBeDefined();
      expect(result!.indicators.supportResistance).toBeDefined();
    });

    it('should handle custom weights', () => {
      const customAggregator = new SignalAggregator({
        weights: {
          rsi: 2.0,
          macd: 1.5,
          bollinger: 1.0,
          stochastic: 1.0,
          obv: 0.5,
          adx: 1.0,
          atr: 0.5,
          supportResistance: 1.5,
        },
      });

      const candles = createCandles(50);
      const result = customAggregator.aggregate(candles);

      expect(result).not.toBeNull();
      expect(result!.indicators.rsi.weight).toBe(2.0);
    });

    it('should respect minimum confidence threshold', () => {
      const customAggregator = new SignalAggregator({
        minConfidence: 80,
      });

      const candles = createCandles(50, 'sideways');
      const result = customAggregator.aggregate(candles);

      expect(result).not.toBeNull();
      if (result!.confidence < 80) {
        expect(result!.signal).toBe('NEUTRAL');
      }
    });
  });

  describe('signal strength calculation', () => {
    it('should calculate higher strength for aligned indicators', () => {
      const candles = createCandles(50, 'uptrend');

      const result = aggregator.aggregate(candles);

      expect(result).not.toBeNull();
      expect(result!.strength).toBeGreaterThan(50);
    });

    it('should calculate lower strength for mixed signals', () => {
      const candles = createCandles(50, 'sideways');

      const result = aggregator.aggregate(candles);

      expect(result).not.toBeNull();
      expect(result!.strength).toBeLessThan(80);
    });
  });

  describe('explanation generation', () => {
    it('should generate explanation for buy signal', () => {
      const candles = createCandles(50, 'uptrend');

      const result = aggregator.aggregate(candles);

      expect(result).not.toBeNull();
      expect(result!.explanation).toContain('BUY');
      expect(result!.explanation.length).toBeGreaterThan(0);
    });

    it('should generate explanation for sell signal', () => {
      const candles = createCandles(50, 'downtrend');

      const result = aggregator.aggregate(candles);

      expect(result).not.toBeNull();
      expect(result!.explanation).toContain('SELL');
    });

    it('should list bullish and bearish indicators', () => {
      const candles = createCandles(50);

      const result = aggregator.aggregate(candles);

      expect(result).not.toBeNull();
      expect(result!.explanation).toBeTruthy();
    });
  });

  describe('edge cases', () => {
    it('should handle flat market', () => {
      const candles = Array.from({ length: 50 }, (_, i) => ({
        symbol: 'BTC-USDT',
        timestamp: new Date(Date.now() - (50 - i) * 60000),
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1000,
      }));

      const result = aggregator.aggregate(candles);

      expect(result).not.toBeNull();
      expect(result!.signal).toBe('NEUTRAL');
    });

    it('should handle high volatility', () => {
      const candles = Array.from({ length: 50 }, (_, i) => ({
        symbol: 'BTC-USDT',
        timestamp: new Date(Date.now() - (50 - i) * 60000),
        open: 100 + (i % 2 === 0 ? 20 : -20),
        high: 110 + (i % 2 === 0 ? 20 : -20),
        low: 90 + (i % 2 === 0 ? 20 : -20),
        close: 100 + (i % 2 === 0 ? 20 : -20),
        volume: 1000 + Math.random() * 1000,
      }));

      const result = aggregator.aggregate(candles);

      expect(result).not.toBeNull();
      expect(typeof result!.signal).toBe('string');
    });
  });
});
