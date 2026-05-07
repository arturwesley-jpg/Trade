import { describe, it, expect } from 'vitest';
import { RSICalculator } from '../rsi';

describe('RSICalculator', () => {
  let calculator: RSICalculator;

  beforeEach(() => {
    calculator = new RSICalculator();
  });

  describe('calculate', () => {
    it('should return null for insufficient data', () => {
      const prices = [100, 102, 101];
      const result = calculator.calculate(prices);
      expect(result).toBeNull();
    });

    it('should calculate RSI correctly for valid data', () => {
      // Generate test data with clear uptrend
      const prices = [
        44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42,
        45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00,
      ];

      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.value).toBeGreaterThan(0);
      expect(result!.value).toBeLessThan(100);
      expect(['OVERBOUGHT', 'OVERSOLD', 'NEUTRAL']).toContain(result!.signal);
      expect(result!.strength).toBeGreaterThanOrEqual(0);
      expect(result!.strength).toBeLessThanOrEqual(1);
    });

    it('should detect overbought condition', () => {
      // Generate strong uptrend data
      const prices = Array.from({ length: 20 }, (_, i) => 100 + i * 2);

      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.value).toBeGreaterThan(70);
      expect(result!.signal).toBe('OVERBOUGHT');
      expect(result!.strength).toBeGreaterThan(0);
    });

    it('should detect oversold condition', () => {
      // Generate strong downtrend data
      const prices = Array.from({ length: 20 }, (_, i) => 100 - i * 2);

      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.value).toBeLessThan(30);
      expect(result!.signal).toBe('OVERSOLD');
      expect(result!.strength).toBeGreaterThan(0);
    });

    it('should detect neutral condition', () => {
      // Generate sideways data
      const prices = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101];

      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.value).toBeGreaterThan(30);
      expect(result!.value).toBeLessThan(70);
      expect(result!.signal).toBe('NEUTRAL');
    });

    it('should handle custom thresholds', () => {
      const customCalculator = new RSICalculator({
        overboughtThreshold: 80,
        oversoldThreshold: 20,
      });

      const prices = Array.from({ length: 20 }, (_, i) => 100 + i * 1.5);
      const result = customCalculator.calculate(prices);

      expect(result).not.toBeNull();
      // With higher threshold, might not be overbought
      expect(['OVERBOUGHT', 'NEUTRAL']).toContain(result!.signal);
    });

    it('should handle custom period', () => {
      const customCalculator = new RSICalculator({ period: 7 });
      const prices = Array.from({ length: 15 }, (_, i) => 100 + i);

      const result = customCalculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.value).toBeGreaterThan(0);
    });
  });

  describe('calculateSeries', () => {
    it('should calculate RSI series', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 5) * 10);

      const series = calculator.calculateSeries(prices);

      expect(series).toHaveLength(30);
      expect(series.slice(0, 14).every(v => v === null)).toBe(true);
      expect(series.slice(14).every(v => v !== null)).toBe(true);
    });

    it('should return all nulls for insufficient data', () => {
      const prices = [100, 101, 102];
      const series = calculator.calculateSeries(prices);

      expect(series).toHaveLength(3);
      expect(series.every(v => v === null)).toBe(true);
    });
  });

  describe('detectDivergence', () => {
    it('should detect bullish divergence', () => {
      const prices = [100, 95, 90, 85]; // Lower lows
      const rsiValues = [40, 35, 38, 42]; // Higher lows

      const divergence = calculator.detectDivergence(prices, rsiValues);

      expect(divergence).toBe('BULLISH');
    });

    it('should detect bearish divergence', () => {
      const prices = [100, 105, 110, 115]; // Higher highs
      const rsiValues = [60, 65, 62, 58]; // Lower highs

      const divergence = calculator.detectDivergence(prices, rsiValues);

      expect(divergence).toBe('BEARISH');
    });

    it('should return null for no divergence', () => {
      const prices = [100, 105, 110, 115]; // Higher highs
      const rsiValues = [50, 55, 60, 65]; // Higher highs (aligned)

      const divergence = calculator.detectDivergence(prices, rsiValues);

      expect(divergence).toBeNull();
    });

    it('should return null for insufficient data', () => {
      const prices = [100, 105];
      const rsiValues = [50, 55];

      const divergence = calculator.detectDivergence(prices, rsiValues);

      expect(divergence).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle all gains (no losses)', () => {
      const prices = Array.from({ length: 20 }, (_, i) => 100 + i);
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.value).toBe(100);
      expect(result!.signal).toBe('OVERBOUGHT');
    });

    it('should handle all losses (no gains)', () => {
      const prices = Array.from({ length: 20 }, (_, i) => 100 - i);
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.value).toBe(0);
      expect(result!.signal).toBe('OVERSOLD');
    });

    it('should handle flat prices', () => {
      const prices = Array.from({ length: 20 }, () => 100);
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.value).toBe(100);
    });
  });
});
