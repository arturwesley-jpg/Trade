import { describe, it, expect, beforeEach } from 'vitest';
import { StochasticCalculator } from '../stochastic';

describe('StochasticCalculator', () => {
  let calculator: StochasticCalculator;

  beforeEach(() => {
    calculator = new StochasticCalculator();
  });

  describe('calculate', () => {
    it('should return null for insufficient data', () => {
      const highs = [102, 103, 104];
      const lows = [98, 99, 100];
      const closes = [100, 101, 102];

      const result = calculator.calculate(highs, lows, closes);

      expect(result).toBeNull();
    });

    it('should calculate Stochastic correctly', () => {
      const highs = Array.from({ length: 20 }, (_, i) => 105 + Math.sin(i / 5) * 5);
      const lows = Array.from({ length: 20 }, (_, i) => 95 + Math.sin(i / 5) * 5);
      const closes = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i / 5) * 5);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.k).toBeGreaterThanOrEqual(0);
      expect(result!.k).toBeLessThanOrEqual(100);
      expect(result!.d).toBeGreaterThanOrEqual(0);
      expect(result!.d).toBeLessThanOrEqual(100);
      expect(['OVERBOUGHT', 'OVERSOLD', 'NEUTRAL']).toContain(result!.signal);
      expect(['BULLISH', 'BEARISH', 'NONE']).toContain(result!.crossover);
      expect(result!.strength).toBeGreaterThanOrEqual(0);
      expect(result!.strength).toBeLessThanOrEqual(1);
    });

    it('should detect overbought condition', () => {
      const highs = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
      const lows = Array.from({ length: 20 }, (_, i) => 98 + i * 2);
      const closes = Array.from({ length: 20 }, (_, i) => 99 + i * 2);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.k).toBeGreaterThan(80);
      expect(result!.signal).toBe('OVERBOUGHT');
    });

    it('should detect oversold condition', () => {
      const highs = Array.from({ length: 20 }, (_, i) => 100 - i * 2);
      const lows = Array.from({ length: 20 }, (_, i) => 98 - i * 2);
      const closes = Array.from({ length: 20 }, (_, i) => 99 - i * 2);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.k).toBeLessThan(20);
      expect(result!.signal).toBe('OVERSOLD');
    });

    it('should detect bullish crossover', () => {
      const highs = Array.from({ length: 20 }, (_, i) => 105);
      const lows = Array.from({ length: 20 }, (_, i) => 95);
      const closes = Array.from({ length: 20 }, (_, i) => 95 + i * 0.5);

      const result1 = calculator.calculate(highs.slice(0, -1), lows.slice(0, -1), closes.slice(0, -1));
      const result2 = calculator.calculate(highs, lows, closes, result1?.k);

      expect(result2).not.toBeNull();
      if (result1 && result1.k <= result1.d && result2!.k > result2!.d) {
        expect(result2!.crossover).toBe('BULLISH');
      }
    });

    it('should detect bearish crossover', () => {
      const highs = Array.from({ length: 20 }, (_, i) => 105);
      const lows = Array.from({ length: 20 }, (_, i) => 95);
      const closes = Array.from({ length: 20 }, (_, i) => 105 - i * 0.5);

      const result1 = calculator.calculate(highs.slice(0, -1), lows.slice(0, -1), closes.slice(0, -1));
      const result2 = calculator.calculate(highs, lows, closes, result1?.k);

      expect(result2).not.toBeNull();
      if (result1 && result1.k >= result1.d && result2!.k < result2!.d) {
        expect(result2!.crossover).toBe('BEARISH');
      }
    });

    it('should handle custom configuration', () => {
      const customCalculator = new StochasticCalculator({
        kPeriod: 10,
        dPeriod: 5,
        overboughtThreshold: 85,
        oversoldThreshold: 15,
      });

      const highs = Array.from({ length: 20 }, (_, i) => 105 + Math.sin(i / 5) * 5);
      const lows = Array.from({ length: 20 }, (_, i) => 95 + Math.sin(i / 5) * 5);
      const closes = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i / 5) * 5);

      const result = customCalculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.k).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero range', () => {
      const highs = Array.from({ length: 20 }, () => 100);
      const lows = Array.from({ length: 20 }, () => 100);
      const closes = Array.from({ length: 20 }, () => 100);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.k).toBe(50); // Neutral when no range
    });
  });

  describe('calculateSeries', () => {
    it('should calculate Stochastic series', () => {
      const highs = Array.from({ length: 30 }, (_, i) => 105 + Math.sin(i / 5) * 5);
      const lows = Array.from({ length: 30 }, (_, i) => 95 + Math.sin(i / 5) * 5);
      const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 5) * 5);

      const series = calculator.calculateSeries(highs, lows, closes);

      expect(series).toHaveLength(30);
      const minLength = 14 + 3 - 1; // kPeriod + dPeriod - 1
      expect(series.slice(0, minLength - 1).every(v => v === null)).toBe(true);
      expect(series.slice(minLength - 1).every(v => v !== null)).toBe(true);
    });
  });

  describe('detectDivergence', () => {
    it('should detect bullish divergence', () => {
      const closes = [100, 95, 90, 85]; // Lower lows
      const kValues = [25, 20, 22, 28]; // Higher lows in oversold

      const divergence = calculator.detectDivergence(closes, kValues);

      expect(divergence).toBe('BULLISH');
    });

    it('should detect bearish divergence', () => {
      const closes = [100, 105, 110, 115]; // Higher highs
      const kValues = [85, 90, 88, 82]; // Lower highs in overbought

      const divergence = calculator.detectDivergence(closes, kValues);

      expect(divergence).toBe('BEARISH');
    });

    it('should return null for no divergence', () => {
      const closes = [100, 105, 110, 115];
      const kValues = [50, 55, 60, 65];

      const divergence = calculator.detectDivergence(closes, kValues);

      expect(divergence).toBeNull();
    });

    it('should return null for insufficient data', () => {
      const closes = [100, 105];
      const kValues = [50, 55];

      const divergence = calculator.detectDivergence(closes, kValues);

      expect(divergence).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle extreme uptrend', () => {
      const highs = Array.from({ length: 20 }, (_, i) => 100 + i * 5);
      const lows = Array.from({ length: 20 }, (_, i) => 95 + i * 5);
      const closes = Array.from({ length: 20 }, (_, i) => 98 + i * 5);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.k).toBeGreaterThan(80);
    });

    it('should handle extreme downtrend', () => {
      const highs = Array.from({ length: 20 }, (_, i) => 100 - i * 5);
      const lows = Array.from({ length: 20 }, (_, i) => 95 - i * 5);
      const closes = Array.from({ length: 20 }, (_, i) => 96 - i * 5);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.k).toBeLessThan(20);
    });
  });
});
