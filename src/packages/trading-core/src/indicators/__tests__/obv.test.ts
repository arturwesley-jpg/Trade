import { describe, it, expect, beforeEach } from 'vitest';
import { OBVCalculator } from '../obv';

describe('OBVCalculator', () => {
  let calculator: OBVCalculator;

  beforeEach(() => {
    calculator = new OBVCalculator();
  });

  describe('calculate', () => {
    it('should return null for insufficient data', () => {
      const closes = [100];
      const volumes = [1000];

      const result = calculator.calculate(closes, volumes);

      expect(result).toBeNull();
    });

    it('should calculate OBV correctly', () => {
      const closes = [100, 102, 101, 103, 102, 104, 103, 105];
      const volumes = [1000, 1200, 800, 1500, 900, 1300, 700, 1400];

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(typeof result!.value).toBe('number');
      expect(['RISING', 'FALLING', 'FLAT']).toContain(result!.trend);
      expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(result!.signal);
      expect([null, 'BULLISH', 'BEARISH']).toContain(result!.divergence);
    });

    it('should detect rising trend', () => {
      const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
      const volumes = Array.from({ length: 20 }, () => 1000);

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.trend).toBe('RISING');
      expect(result!.signal).toBe('BULLISH');
    });

    it('should detect falling trend', () => {
      const closes = Array.from({ length: 20 }, (_, i) => 100 - i);
      const volumes = Array.from({ length: 20 }, () => 1000);

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.trend).toBe('FALLING');
      expect(result!.signal).toBe('BEARISH');
    });

    it('should accumulate volume on up days', () => {
      const closes = [100, 101, 102];
      const volumes = [1000, 1000, 1000];

      const series = calculator.calculateSeries(closes, volumes);

      expect(series[0]).toBe(1000);
      expect(series[1]).toBe(2000);
      expect(series[2]).toBe(3000);
    });

    it('should subtract volume on down days', () => {
      const closes = [100, 99, 98];
      const volumes = [1000, 1000, 1000];

      const series = calculator.calculateSeries(closes, volumes);

      expect(series[0]).toBe(1000);
      expect(series[1]).toBe(0);
      expect(series[2]).toBe(-1000);
    });

    it('should keep OBV unchanged on flat days', () => {
      const closes = [100, 100, 100];
      const volumes = [1000, 1000, 1000];

      const series = calculator.calculateSeries(closes, volumes);

      expect(series[0]).toBe(1000);
      expect(series[1]).toBe(1000);
      expect(series[2]).toBe(1000);
    });

    it('should handle custom configuration', () => {
      const customCalculator = new OBVCalculator({
        trendPeriod: 5,
        divergencePeriod: 10,
      });

      const closes = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i / 5) * 10);
      const volumes = Array.from({ length: 20 }, () => 1000);

      const result = customCalculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(typeof result!.value).toBe('number');
    });
  });

  describe('calculateSeries', () => {
    it('should calculate OBV series', () => {
      const closes = [100, 102, 101, 103, 102, 104];
      const volumes = [1000, 1200, 800, 1500, 900, 1300];

      const series = calculator.calculateSeries(closes, volumes);

      expect(series).toHaveLength(6);
      expect(series[0]).toBe(1000);
      expect(series.every(v => typeof v === 'number')).toBe(true);
    });

    it('should return empty array for insufficient data', () => {
      const closes: number[] = [];
      const volumes: number[] = [];

      const series = calculator.calculateSeries(closes, volumes);

      expect(series).toHaveLength(0);
    });
  });

  describe('detectDivergence', () => {
    it('should detect bullish divergence', () => {
      // Price making lower lows
      const prices = Array.from({ length: 20 }, (_, i) => {
        if (i === 5) return 100;
        if (i === 15) return 95;
        return 102 - i * 0.2;
      });

      // OBV making higher lows
      const obvValues = Array.from({ length: 20 }, (_, i) => {
        if (i === 5) return 1000;
        if (i === 15) return 1200;
        return 1100 + i * 10;
      });

      const divergence = calculator.detectDivergence(prices, obvValues);

      expect(divergence).toBe('BULLISH');
    });

    it('should detect bearish divergence', () => {
      // Price making higher highs
      const prices = Array.from({ length: 20 }, (_, i) => {
        if (i === 5) return 100;
        if (i === 15) return 105;
        return 98 + i * 0.2;
      });

      // OBV making lower highs
      const obvValues = Array.from({ length: 20 }, (_, i) => {
        if (i === 5) return 2000;
        if (i === 15) return 1800;
        return 2100 - i * 10;
      });

      const divergence = calculator.detectDivergence(prices, obvValues);

      expect(divergence).toBe('BEARISH');
    });

    it('should return null for no divergence', () => {
      const prices = Array.from({ length: 20 }, (_, i) => 100 + i);
      const obvValues = Array.from({ length: 20 }, (_, i) => 1000 + i * 100);

      const divergence = calculator.detectDivergence(prices, obvValues);

      expect(divergence).toBeNull();
    });

    it('should return null for insufficient data', () => {
      const prices = [100, 101];
      const obvValues = [1000, 1100];

      const divergence = calculator.detectDivergence(prices, obvValues);

      expect(divergence).toBeNull();
    });
  });

  describe('calculateMomentum', () => {
    it('should calculate OBV momentum', () => {
      const obvValues = Array.from({ length: 20 }, (_, i) => 1000 + i * 100);

      const momentum = calculator.calculateMomentum(obvValues, 10);

      expect(momentum).not.toBeNull();
      expect(momentum).toBeGreaterThan(0);
    });

    it('should return null for insufficient data', () => {
      const obvValues = [1000, 1100, 1200];

      const momentum = calculator.calculateMomentum(obvValues, 10);

      expect(momentum).toBeNull();
    });

    it('should calculate positive momentum for rising OBV', () => {
      const obvValues = Array.from({ length: 20 }, (_, i) => 1000 + i * 100);

      const momentum = calculator.calculateMomentum(obvValues, 5);

      expect(momentum).toBeGreaterThan(0);
    });

    it('should calculate negative momentum for falling OBV', () => {
      const obvValues = Array.from({ length: 20 }, (_, i) => 2000 - i * 100);

      const momentum = calculator.calculateMomentum(obvValues, 5);

      expect(momentum).toBeLessThan(0);
    });

    it('should handle zero previous value', () => {
      const obvValues = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100];

      const momentum = calculator.calculateMomentum(obvValues, 10);

      expect(momentum).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle mismatched array lengths', () => {
      const closes = [100, 101, 102];
      const volumes = [1000, 1100];

      const result = calculator.calculate(closes, volumes);

      expect(result).toBeNull();
    });

    it('should handle zero volumes', () => {
      const closes = [100, 101, 102, 103];
      const volumes = [0, 0, 0, 0];

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.value).toBe(0);
    });

    it('should handle large volume spikes', () => {
      const closes = [100, 101, 102, 103];
      const volumes = [1000, 10000, 1000, 1000];

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(Math.abs(result!.value)).toBeGreaterThan(1000);
    });
  });
});
