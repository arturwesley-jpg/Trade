import { describe, it, expect, beforeEach } from 'vitest';
import { ADXCalculator } from '../adx';

describe('ADXCalculator', () => {
  let calculator: ADXCalculator;

  beforeEach(() => {
    calculator = new ADXCalculator();
  });

  describe('calculate', () => {
    it('should return null for insufficient data', () => {
      const highs = [102, 103, 104];
      const lows = [98, 99, 100];
      const closes = [100, 101, 102];

      const result = calculator.calculate(highs, lows, closes);

      expect(result).toBeNull();
    });

    it('should calculate ADX correctly', () => {
      const highs = Array.from({ length: 40 }, (_, i) => 105 + Math.sin(i / 5) * 10);
      const lows = Array.from({ length: 40 }, (_, i) => 95 + Math.sin(i / 5) * 10);
      const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 5) * 10);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.adx).toBeGreaterThanOrEqual(0);
      expect(result!.adx).toBeLessThanOrEqual(100);
      expect(result!.plusDI).toBeGreaterThanOrEqual(0);
      expect(result!.plusDI).toBeLessThanOrEqual(100);
      expect(result!.minusDI).toBeGreaterThanOrEqual(0);
      expect(result!.minusDI).toBeLessThanOrEqual(100);
      expect(['STRONG', 'MODERATE', 'WEAK']).toContain(result!.trendStrength);
      expect(['UP', 'DOWN', 'NEUTRAL']).toContain(result!.trendDirection);
    });

    it('should detect strong uptrend', () => {
      const highs = Array.from({ length: 40 }, (_, i) => 100 + i * 2);
      const lows = Array.from({ length: 40 }, (_, i) => 95 + i * 2);
      const closes = Array.from({ length: 40 }, (_, i) => 98 + i * 2);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.trendDirection).toBe('UP');
      expect(result!.plusDI).toBeGreaterThan(result!.minusDI);
    });

    it('should detect strong downtrend', () => {
      const highs = Array.from({ length: 40 }, (_, i) => 100 - i * 2);
      const lows = Array.from({ length: 40 }, (_, i) => 95 - i * 2);
      const closes = Array.from({ length: 40 }, (_, i) => 96 - i * 2);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.trendDirection).toBe('DOWN');
      expect(result!.minusDI).toBeGreaterThan(result!.plusDI);
    });

    it('should detect weak trend', () => {
      const highs = Array.from({ length: 40 }, () => 105);
      const lows = Array.from({ length: 40 }, () => 95);
      const closes = Array.from({ length: 40 }, (_, i) => 100 + (i % 2 === 0 ? 2 : -2));

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.trendStrength).toBe('WEAK');
      expect(result!.adx).toBeLessThan(20);
    });

    it('should detect strong trend', () => {
      const highs = Array.from({ length: 40 }, (_, i) => 100 + i * 3);
      const lows = Array.from({ length: 40 }, (_, i) => 95 + i * 3);
      const closes = Array.from({ length: 40 }, (_, i) => 98 + i * 3);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(['STRONG', 'MODERATE']).toContain(result!.trendStrength);
      expect(result!.adx).toBeGreaterThan(20);
    });

    it('should handle custom configuration', () => {
      const customCalculator = new ADXCalculator({
        period: 10,
        strongThreshold: 30,
        weakThreshold: 15,
      });

      const highs = Array.from({ length: 40 }, (_, i) => 105 + Math.sin(i / 5) * 10);
      const lows = Array.from({ length: 40 }, (_, i) => 95 + Math.sin(i / 5) * 10);
      const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 5) * 10);

      const result = customCalculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.adx).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateSeries', () => {
    it('should calculate ADX series', () => {
      const highs = Array.from({ length: 50 }, (_, i) => 105 + Math.sin(i / 5) * 10);
      const lows = Array.from({ length: 50 }, (_, i) => 95 + Math.sin(i / 5) * 10);
      const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);

      const series = calculator.calculateSeries(highs, lows, closes);

      expect(series).toHaveLength(50);
      const minLength = 14 * 2 + 1; // period * 2 + 1
      expect(series.slice(0, minLength - 1).every(v => v === null)).toBe(true);
      expect(series.slice(minLength - 1).every(v => v !== null)).toBe(true);
    });
  });

  describe('detectTrendChange', () => {
    it('should detect bullish trend change', () => {
      const results = [
        {
          adx: 25,
          plusDI: 15,
          minusDI: 20,
          trendStrength: 'STRONG' as const,
          trendDirection: 'DOWN' as const,
          timestamp: new Date(),
        },
        {
          adx: 28,
          plusDI: 25,
          minusDI: 18,
          trendStrength: 'STRONG' as const,
          trendDirection: 'UP' as const,
          timestamp: new Date(),
        },
      ];

      const change = calculator.detectTrendChange(results);

      expect(change).toBe('BULLISH');
    });

    it('should detect bearish trend change', () => {
      const results = [
        {
          adx: 25,
          plusDI: 20,
          minusDI: 15,
          trendStrength: 'STRONG' as const,
          trendDirection: 'UP' as const,
          timestamp: new Date(),
        },
        {
          adx: 28,
          plusDI: 18,
          minusDI: 25,
          trendStrength: 'STRONG' as const,
          trendDirection: 'DOWN' as const,
          timestamp: new Date(),
        },
      ];

      const change = calculator.detectTrendChange(results);

      expect(change).toBe('BEARISH');
    });

    it('should return null for no trend change', () => {
      const results = [
        {
          adx: 25,
          plusDI: 25,
          minusDI: 15,
          trendStrength: 'STRONG' as const,
          trendDirection: 'UP' as const,
          timestamp: new Date(),
        },
        {
          adx: 28,
          plusDI: 28,
          minusDI: 16,
          trendStrength: 'STRONG' as const,
          trendDirection: 'UP' as const,
          timestamp: new Date(),
        },
      ];

      const change = calculator.detectTrendChange(results);

      expect(change).toBeNull();
    });

    it('should return null for insufficient data', () => {
      const results = [
        {
          adx: 25,
          plusDI: 25,
          minusDI: 15,
          trendStrength: 'STRONG' as const,
          trendDirection: 'UP' as const,
          timestamp: new Date(),
        },
      ];

      const change = calculator.detectTrendChange(results);

      expect(change).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle flat prices', () => {
      const highs = Array.from({ length: 40 }, () => 100);
      const lows = Array.from({ length: 40 }, () => 100);
      const closes = Array.from({ length: 40 }, () => 100);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.adx).toBe(0);
      expect(result!.plusDI).toBe(0);
      expect(result!.minusDI).toBe(0);
    });

    it('should handle high volatility', () => {
      const highs = Array.from({ length: 40 }, (_, i) => 100 + (i % 2 === 0 ? 20 : -20));
      const lows = Array.from({ length: 40 }, (_, i) => 80 + (i % 2 === 0 ? 20 : -20));
      const closes = Array.from({ length: 40 }, (_, i) => 90 + (i % 2 === 0 ? 20 : -20));

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(typeof result!.adx).toBe('number');
    });
  });
});
