import { describe, it, expect, beforeEach } from 'vitest';
import { BollingerBandsCalculator } from '../bollinger-bands';

describe('BollingerBandsCalculator', () => {
  let calculator: BollingerBandsCalculator;

  beforeEach(() => {
    calculator = new BollingerBandsCalculator();
  });

  describe('calculate', () => {
    it('should return null for insufficient data', () => {
      const prices = [100, 101, 102];
      const result = calculator.calculate(prices);

      expect(result).toBeNull();
    });

    it('should calculate Bollinger Bands correctly', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 5) * 10);

      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.upper).toBeGreaterThan(result!.middle);
      expect(result!.middle).toBeGreaterThan(result!.lower);
      expect(result!.bandwidth).toBeGreaterThan(0);
      expect(result!.percentB).toBeGreaterThanOrEqual(-0.5);
      expect(result!.percentB).toBeLessThanOrEqual(1.5);
      expect(['OVERBOUGHT', 'OVERSOLD', 'NEUTRAL']).toContain(result!.signal);
      expect(typeof result!.squeeze).toBe('boolean');
    });

    it('should detect overbought condition', () => {
      const prices = Array.from({ length: 25 }, () => 100);
      prices.push(120); // Price above upper band

      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.percentB).toBeGreaterThan(1);
      expect(result!.signal).toBe('OVERBOUGHT');
    });

    it('should detect oversold condition', () => {
      const prices = Array.from({ length: 25 }, () => 100);
      prices.push(80); // Price below lower band

      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.percentB).toBeLessThan(0);
      expect(result!.signal).toBe('OVERSOLD');
    });

    it('should detect squeeze', () => {
      const prices = Array.from({ length: 25 }, () => 100); // Very low volatility

      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.squeeze).toBe(true);
      expect(result!.bandwidth).toBeLessThan(0.1);
    });

    it('should handle custom configuration', () => {
      const customCalculator = new BollingerBandsCalculator({
        period: 10,
        stdDev: 3,
        squeezeThreshold: 0.05,
      });

      const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 5) * 10);
      const result = customCalculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.upper).toBeGreaterThan(result!.middle);
    });

    it('should calculate percentB correctly', () => {
      const prices = Array.from({ length: 25 }, () => 100);
      const result = calculator.calculate(prices, 100);

      expect(result).not.toBeNull();
      expect(result!.percentB).toBeCloseTo(0.5, 1); // Price at middle band
    });
  });

  describe('calculateSeries', () => {
    it('should calculate Bollinger Bands series', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 5) * 10);

      const series = calculator.calculateSeries(prices);

      expect(series).toHaveLength(30);
      expect(series.slice(0, 19).every(v => v === null)).toBe(true);
      expect(series.slice(19).every(v => v !== null)).toBe(true);
    });
  });

  describe('detectBreakout', () => {
    it('should detect bullish breakout', () => {
      const bands = [
        { squeeze: true, percentB: 0.5, upper: 105, middle: 100, lower: 95, bandwidth: 0.08, signal: 'NEUTRAL' as const, timestamp: new Date() },
        { squeeze: true, percentB: 0.6, upper: 105, middle: 100, lower: 95, bandwidth: 0.09, signal: 'NEUTRAL' as const, timestamp: new Date() },
        { squeeze: false, percentB: 0.85, upper: 110, middle: 100, lower: 90, bandwidth: 0.15, signal: 'NEUTRAL' as const, timestamp: new Date() },
      ];

      const breakout = calculator.detectBreakout(bands);

      expect(breakout).toBe('BULLISH');
    });

    it('should detect bearish breakout', () => {
      const bands = [
        { squeeze: true, percentB: 0.5, upper: 105, middle: 100, lower: 95, bandwidth: 0.08, signal: 'NEUTRAL' as const, timestamp: new Date() },
        { squeeze: true, percentB: 0.4, upper: 105, middle: 100, lower: 95, bandwidth: 0.09, signal: 'NEUTRAL' as const, timestamp: new Date() },
        { squeeze: false, percentB: 0.15, upper: 110, middle: 100, lower: 90, bandwidth: 0.15, signal: 'NEUTRAL' as const, timestamp: new Date() },
      ];

      const breakout = calculator.detectBreakout(bands);

      expect(breakout).toBe('BEARISH');
    });

    it('should return null for no breakout', () => {
      const bands = [
        { squeeze: false, percentB: 0.5, upper: 105, middle: 100, lower: 95, bandwidth: 0.15, signal: 'NEUTRAL' as const, timestamp: new Date() },
        { squeeze: false, percentB: 0.5, upper: 105, middle: 100, lower: 95, bandwidth: 0.15, signal: 'NEUTRAL' as const, timestamp: new Date() },
        { squeeze: false, percentB: 0.5, upper: 105, middle: 100, lower: 95, bandwidth: 0.15, signal: 'NEUTRAL' as const, timestamp: new Date() },
      ];

      const breakout = calculator.detectBreakout(bands);

      expect(breakout).toBeNull();
    });
  });

  describe('detectWalk', () => {
    it('should detect upper band walk', () => {
      const bands = Array.from({ length: 5 }, () => ({
        percentB: 0.95,
        upper: 110,
        middle: 100,
        lower: 90,
        bandwidth: 0.2,
        signal: 'OVERBOUGHT' as const,
        squeeze: false,
        timestamp: new Date(),
      }));

      const walk = calculator.detectWalk(bands);

      expect(walk).toBe('UPPER_WALK');
    });

    it('should detect lower band walk', () => {
      const bands = Array.from({ length: 5 }, () => ({
        percentB: 0.05,
        upper: 110,
        middle: 100,
        lower: 90,
        bandwidth: 0.2,
        signal: 'OVERSOLD' as const,
        squeeze: false,
        timestamp: new Date(),
      }));

      const walk = calculator.detectWalk(bands);

      expect(walk).toBe('LOWER_WALK');
    });

    it('should return null for no walk', () => {
      const bands = Array.from({ length: 5 }, () => ({
        percentB: 0.5,
        upper: 110,
        middle: 100,
        lower: 90,
        bandwidth: 0.2,
        signal: 'NEUTRAL' as const,
        squeeze: false,
        timestamp: new Date(),
      }));

      const walk = calculator.detectWalk(bands);

      expect(walk).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle flat prices', () => {
      const prices = Array.from({ length: 25 }, () => 100);
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.upper).toBe(result!.middle);
      expect(result!.lower).toBe(result!.middle);
      expect(result!.bandwidth).toBe(0);
    });

    it('should handle high volatility', () => {
      const prices = Array.from({ length: 25 }, (_, i) => 100 + (i % 2 === 0 ? 20 : -20));
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.bandwidth).toBeGreaterThan(0.1);
      expect(result!.squeeze).toBe(false);
    });
  });
});
