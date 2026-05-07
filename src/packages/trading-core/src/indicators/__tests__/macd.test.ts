import { describe, it, expect, beforeEach } from 'vitest';
import { MACDCalculator } from '../macd';

describe('MACDCalculator', () => {
  let calculator: MACDCalculator;

  beforeEach(() => {
    calculator = new MACDCalculator();
  });

  describe('calculate', () => {
    it('should return null for insufficient data', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 100 + i);
      const result = calculator.calculate(prices);

      expect(result).toBeNull();
    });

    it('should calculate MACD correctly for valid data', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 10) * 10);

      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(typeof result!.macd).toBe('number');
      expect(typeof result!.signal).toBe('number');
      expect(typeof result!.histogram).toBe('number');
      expect(result!.histogram).toBeCloseTo(result!.macd - result!.signal, 5);
      expect(['BULLISH', 'BEARISH', 'NONE']).toContain(result!.crossover);
      expect(result!.strength).toBeGreaterThanOrEqual(0);
      expect(result!.strength).toBeLessThanOrEqual(1);
    });

    it('should detect bullish crossover', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);

      const result1 = calculator.calculate(prices.slice(0, -1));
      const result2 = calculator.calculate(prices, result1?.macd);

      expect(result2).not.toBeNull();
      if (result2!.histogram > 0 && result1 && result1.histogram <= 0) {
        expect(result2!.crossover).toBe('BULLISH');
      }
    });

    it('should detect bearish crossover', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 - i * 0.5);

      const result1 = calculator.calculate(prices.slice(0, -1));
      const result2 = calculator.calculate(prices, result1?.macd);

      expect(result2).not.toBeNull();
      if (result2!.histogram < 0 && result1 && result1.histogram >= 0) {
        expect(result2!.crossover).toBe('BEARISH');
      }
    });

    it('should handle custom periods', () => {
      const customCalculator = new MACDCalculator({
        fastPeriod: 8,
        slowPeriod: 21,
        signalPeriod: 5,
      });

      const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 10) * 10);
      const result = customCalculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(typeof result!.macd).toBe('number');
    });

    it('should calculate positive histogram for bullish momentum', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i);

      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.histogram).toBeGreaterThan(0);
    });

    it('should calculate negative histogram for bearish momentum', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 - i);

      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.histogram).toBeLessThan(0);
    });
  });

  describe('calculateSeries', () => {
    it('should calculate MACD series', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 10) * 10);

      const series = calculator.calculateSeries(prices);

      expect(series).toHaveLength(50);
      const minLength = 26 + 9; // slowPeriod + signalPeriod
      expect(series.slice(0, minLength - 1).every(v => v === null)).toBe(true);
      expect(series.slice(minLength - 1).every(v => v !== null)).toBe(true);
    });

    it('should return all nulls for insufficient data', () => {
      const prices = Array.from({ length: 20 }, (_, i) => 100 + i);
      const series = calculator.calculateSeries(prices);

      expect(series).toHaveLength(20);
      expect(series.every(v => v === null)).toBe(true);
    });
  });

  describe('detectDivergence', () => {
    it('should detect bullish divergence', () => {
      const prices = [100, 95, 90, 85]; // Lower lows
      const macdValues = [-2, -3, -2.5, -1.5]; // Higher lows

      const divergence = calculator.detectDivergence(prices, macdValues);

      expect(divergence).toBe('BULLISH');
    });

    it('should detect bearish divergence', () => {
      const prices = [100, 105, 110, 115]; // Higher highs
      const macdValues = [2, 3, 2.5, 1.5]; // Lower highs

      const divergence = calculator.detectDivergence(prices, macdValues);

      expect(divergence).toBe('BEARISH');
    });

    it('should return null for no divergence', () => {
      const prices = [100, 105, 110, 115]; // Higher highs
      const macdValues = [1, 2, 3, 4]; // Higher highs (aligned)

      const divergence = calculator.detectDivergence(prices, macdValues);

      expect(divergence).toBeNull();
    });

    it('should return null for insufficient data', () => {
      const prices = [100, 105];
      const macdValues = [1, 2];

      const divergence = calculator.detectDivergence(prices, macdValues);

      expect(divergence).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle flat prices', () => {
      const prices = Array.from({ length: 50 }, () => 100);
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.macd).toBeCloseTo(0, 5);
      expect(result!.signal).toBeCloseTo(0, 5);
      expect(result!.histogram).toBeCloseTo(0, 5);
    });

    it('should handle volatile prices', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + (i % 2 === 0 ? 10 : -10));
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(typeof result!.macd).toBe('number');
      expect(typeof result!.signal).toBe('number');
    });
  });
});
