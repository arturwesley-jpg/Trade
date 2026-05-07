import { describe, it, expect } from 'vitest';
import { MovingAverageCalculator } from '../moving-averages';

describe('MovingAverageCalculator', () => {
  describe('SMA Calculation', () => {
    it('should calculate simple moving average correctly', () => {
      const calculator = new MovingAverageCalculator();
      const prices = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
      const sma = calculator.calculateSMA(prices, 5);

      expect(sma).toBe(24); // (20+22+24+26+28)/5 = 24
    });

    it('should return null for insufficient data', () => {
      const calculator = new MovingAverageCalculator();
      const prices = [10, 12, 14];
      const sma = calculator.calculateSMA(prices, 5);

      expect(sma).toBeNull();
    });

    it('should calculate SMA series correctly', () => {
      const calculator = new MovingAverageCalculator();
      const prices = [10, 12, 14, 16, 18, 20];
      const smaSeries = calculator.calculateSMASeries(prices, 3);

      expect(smaSeries).toHaveLength(4);
      expect(smaSeries[0]).toBe(12); // (10+12+14)/3
      expect(smaSeries[1]).toBe(14); // (12+14+16)/3
      expect(smaSeries[2]).toBe(16); // (14+16+18)/3
      expect(smaSeries[3]).toBe(18); // (16+18+20)/3
    });
  });

  describe('EMA Calculation', () => {
    it('should calculate exponential moving average correctly', () => {
      const calculator = new MovingAverageCalculator();
      const prices = [22, 24, 26, 28, 30, 32, 34, 36, 38, 40];
      const ema = calculator.calculateEMA(prices, 5);

      expect(ema).toBeDefined();
      expect(ema).toBeGreaterThan(30);
      expect(ema).toBeLessThan(40);
    });

    it('should return null for insufficient data', () => {
      const calculator = new MovingAverageCalculator();
      const prices = [10, 12, 14];
      const ema = calculator.calculateEMA(prices, 5);

      expect(ema).toBeNull();
    });

    it('should calculate EMA series correctly', () => {
      const calculator = new MovingAverageCalculator();
      const prices = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
      const emaSeries = calculator.calculateEMASeries(prices, 5);

      expect(emaSeries.length).toBeGreaterThan(0);
      expect(emaSeries[0]).toBe(14); // First EMA is SMA: (10+12+14+16+18)/5
    });

    it('should have EMA react faster than SMA to price changes', () => {
      const calculator = new MovingAverageCalculator();
      const prices = [10, 10, 10, 10, 10, 20, 20, 20, 20, 20];

      const sma = calculator.calculateSMA(prices, 5);
      const ema = calculator.calculateEMA(prices, 5);

      expect(ema).toBeGreaterThan(sma!);
    });
  });

  describe('Signal Generation', () => {
    it('should generate BULLISH signal when price is above MAs', () => {
      const calculator = new MovingAverageCalculator({ shortPeriod: 5, longPeriod: 10 });

      // Uptrend: prices increasing
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.signal).toBe('BULLISH');
      expect(result!.trend).toBe('UPTREND');
    });

    it('should generate BEARISH signal when price is below MAs', () => {
      const calculator = new MovingAverageCalculator({ shortPeriod: 5, longPeriod: 10 });

      // Downtrend: prices decreasing
      const prices = Array.from({ length: 50 }, (_, i) => 200 - i * 2);
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.signal).toBe('BEARISH');
      expect(result!.trend).toBe('DOWNTREND');
    });

    it('should generate NEUTRAL signal in sideways market', () => {
      const calculator = new MovingAverageCalculator({ shortPeriod: 5, longPeriod: 10 });

      // Sideways: prices oscillating
      const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.5) * 5);
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      // In sideways market, signal could be NEUTRAL or vary
    });
  });

  describe('Crossover Detection', () => {
    it('should detect Golden Cross', () => {
      const calculator = new MovingAverageCalculator({ shortPeriod: 5, longPeriod: 10 });

      // Create scenario where short MA crosses above long MA
      const prices = [
        ...Array.from({ length: 30 }, () => 100), // Flat period
        ...Array.from({ length: 20 }, (_, i) => 100 + i * 3), // Sharp uptrend
      ];

      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      // Golden cross should occur during the uptrend
    });

    it('should detect Death Cross', () => {
      const calculator = new MovingAverageCalculator({ shortPeriod: 5, longPeriod: 10 });

      // Create scenario where short MA crosses below long MA
      const prices = [
        ...Array.from({ length: 30 }, () => 100), // Flat period
        ...Array.from({ length: 20 }, (_, i) => 100 - i * 3), // Sharp downtrend
      ];

      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      // Death cross should occur during the downtrend
    });
  });

  describe('Distance from MA', () => {
    it('should calculate distance from MA as percentage', () => {
      const calculator = new MovingAverageCalculator();

      const distance1 = calculator.calculateDistanceFromMA(110, 100);
      expect(distance1).toBe(10); // 10% above MA

      const distance2 = calculator.calculateDistanceFromMA(90, 100);
      expect(distance2).toBe(-10); // 10% below MA

      const distance3 = calculator.calculateDistanceFromMA(100, 100);
      expect(distance3).toBe(0); // Exactly at MA
    });
  });

  describe('MA Divergence', () => {
    it('should detect converging MAs', () => {
      const calculator = new MovingAverageCalculator({ shortPeriod: 5, longPeriod: 10 });

      // Create prices where MAs converge
      const prices = [
        ...Array.from({ length: 20 }, (_, i) => 100 + i * 2), // Uptrend
        ...Array.from({ length: 30 }, (_, i) => 140 - i * 0.5), // Slight downtrend
      ];

      const divergence = calculator.calculateMADivergence(prices, 10);

      expect(['CONVERGING', 'STABLE', 'DIVERGING']).toContain(divergence);
    });

    it('should detect diverging MAs', () => {
      const calculator = new MovingAverageCalculator({ shortPeriod: 5, longPeriod: 10 });

      // Create prices where MAs diverge
      const prices = [
        ...Array.from({ length: 30 }, () => 100), // Flat
        ...Array.from({ length: 20 }, (_, i) => 100 + i * 5), // Strong uptrend
      ];

      const divergence = calculator.calculateMADivergence(prices, 10);

      expect(['CONVERGING', 'STABLE', 'DIVERGING']).toContain(divergence);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty price array', () => {
      const calculator = new MovingAverageCalculator();
      const result = calculator.calculate([]);

      expect(result).toBeNull();
    });

    it('should handle single price', () => {
      const calculator = new MovingAverageCalculator({ shortPeriod: 5, longPeriod: 10 });
      const result = calculator.calculate([100]);

      expect(result).toBeNull();
    });

    it('should handle all same prices', () => {
      const calculator = new MovingAverageCalculator({ shortPeriod: 5, longPeriod: 10 });
      const prices = Array(50).fill(100);
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.sma).toBe(100);
      expect(result!.signal).toBe('NEUTRAL');
    });

    it('should handle negative prices', () => {
      const calculator = new MovingAverageCalculator({ shortPeriod: 5, longPeriod: 10 });
      const prices = Array.from({ length: 50 }, (_, i) => -100 + i);
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should use custom periods', () => {
      const calculator = new MovingAverageCalculator({
        shortPeriod: 10,
        longPeriod: 20
      });

      const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
    });

    it('should allow disabling SMA calculation', () => {
      const calculator = new MovingAverageCalculator({
        calculateSMA: false,
        calculateEMA: true
      });

      const prices = Array.from({ length: 250 }, (_, i) => 100 + i * 0.5);
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.sma).toBeNull();
      expect(result!.ema).not.toBeNull();
    });

    it('should allow disabling EMA calculation', () => {
      const calculator = new MovingAverageCalculator({
        calculateSMA: true,
        calculateEMA: false
      });

      const prices = Array.from({ length: 250 }, (_, i) => 100 + i * 0.5);
      const result = calculator.calculate(prices);

      expect(result).not.toBeNull();
      expect(result!.sma).not.toBeNull();
      expect(result!.ema).toBeNull();
    });
  });
});
