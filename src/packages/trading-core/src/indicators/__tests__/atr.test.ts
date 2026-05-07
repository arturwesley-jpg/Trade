import { describe, it, expect, beforeEach } from 'vitest';
import { ATRCalculator } from '../atr';

describe('ATRCalculator', () => {
  let calculator: ATRCalculator;

  beforeEach(() => {
    calculator = new ATRCalculator();
  });

  describe('calculate', () => {
    it('should return null for insufficient data', () => {
      const highs = [102, 103, 104];
      const lows = [98, 99, 100];
      const closes = [100, 101, 102];

      const result = calculator.calculate(highs, lows, closes);

      expect(result).toBeNull();
    });

    it('should calculate ATR correctly', () => {
      const highs = Array.from({ length: 20 }, (_, i) => 105 + Math.sin(i / 5) * 10);
      const lows = Array.from({ length: 20 }, (_, i) => 95 + Math.sin(i / 5) * 10);
      const closes = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i / 5) * 10);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.value).toBeGreaterThan(0);
      expect(result!.percentOfPrice).toBeGreaterThan(0);
      expect(['HIGH', 'MODERATE', 'LOW']).toContain(result!.volatility);
      expect(['RISING', 'FALLING', 'STABLE']).toContain(result!.trend);
    });

    it('should detect high volatility', () => {
      const highs = Array.from({ length: 20 }, (_, i) => 100 + (i % 2 === 0 ? 10 : -10));
      const lows = Array.from({ length: 20 }, (_, i) => 80 + (i % 2 === 0 ? 10 : -10));
      const closes = Array.from({ length: 20 }, (_, i) => 90 + (i % 2 === 0 ? 10 : -10));

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.volatility).toBe('HIGH');
      expect(result!.percentOfPrice).toBeGreaterThan(3);
    });

    it('should detect low volatility', () => {
      const highs = Array.from({ length: 20 }, () => 101);
      const lows = Array.from({ length: 20 }, () => 99);
      const closes = Array.from({ length: 20 }, () => 100);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.volatility).toBe('LOW');
      expect(result!.percentOfPrice).toBeLessThan(1);
    });

    it('should detect rising volatility trend', () => {
      const highs = Array.from({ length: 40 }, (_, i) => 100 + i * 0.5);
      const lows = Array.from({ length: 40 }, (_, i) => 95 + i * 0.3);
      const closes = Array.from({ length: 40 }, (_, i) => 98 + i * 0.4);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(['RISING', 'STABLE']).toContain(result!.trend);
    });

    it('should handle custom configuration', () => {
      const customCalculator = new ATRCalculator({
        period: 10,
        highVolatilityThreshold: 0.05,
        lowVolatilityThreshold: 0.02,
      });

      const highs = Array.from({ length: 20 }, (_, i) => 105 + Math.sin(i / 5) * 10);
      const lows = Array.from({ length: 20 }, (_, i) => 95 + Math.sin(i / 5) * 10);
      const closes = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i / 5) * 10);

      const result = customCalculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.value).toBeGreaterThan(0);
    });
  });

  describe('calculateSeries', () => {
    it('should calculate ATR series', () => {
      const highs = Array.from({ length: 30 }, (_, i) => 105 + Math.sin(i / 5) * 10);
      const lows = Array.from({ length: 30 }, (_, i) => 95 + Math.sin(i / 5) * 10);
      const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i / 5) * 10);

      const series = calculator.calculateSeries(highs, lows, closes);

      expect(series).toHaveLength(30);
      expect(series.slice(0, 14).every(v => v === null)).toBe(true);
      expect(series.slice(14).every(v => v !== null && v > 0)).toBe(true);
    });
  });

  describe('calculatePositionSize', () => {
    it('should calculate position size correctly', () => {
      const result = calculator.calculatePositionSize(
        10000, // account balance
        1, // 1% risk
        2, // ATR value
        100, // entry price
        2 // stop loss multiplier
      );

      expect(result.positionSize).toBeCloseTo(25, 1); // 100 / 4
      expect(result.stopLossDistance).toBe(4);
      expect(result.stopLossPrice).toBe(96);
    });

    it('should handle different risk percentages', () => {
      const result1 = calculator.calculatePositionSize(10000, 1, 2, 100, 2);
      const result2 = calculator.calculatePositionSize(10000, 2, 2, 100, 2);

      expect(result2.positionSize).toBeCloseTo(result1.positionSize * 2, 1);
    });

    it('should handle different ATR values', () => {
      const result1 = calculator.calculatePositionSize(10000, 1, 2, 100, 2);
      const result2 = calculator.calculatePositionSize(10000, 1, 4, 100, 2);

      expect(result2.positionSize).toBeCloseTo(result1.positionSize / 2, 1);
    });
  });

  describe('calculateStopLoss', () => {
    it('should calculate stop loss for long position', () => {
      const stopLoss = calculator.calculateStopLoss(100, 2, 2, 'LONG');

      expect(stopLoss).toBe(96); // 100 - (2 * 2)
    });

    it('should calculate stop loss for short position', () => {
      const stopLoss = calculator.calculateStopLoss(100, 2, 2, 'SHORT');

      expect(stopLoss).toBe(104); // 100 + (2 * 2)
    });

    it('should handle different multipliers', () => {
      const stopLoss1 = calculator.calculateStopLoss(100, 2, 1, 'LONG');
      const stopLoss2 = calculator.calculateStopLoss(100, 2, 3, 'LONG');

      expect(stopLoss1).toBe(98);
      expect(stopLoss2).toBe(94);
    });
  });

  describe('calculateTakeProfit', () => {
    it('should calculate take profit for long position', () => {
      const takeProfit = calculator.calculateTakeProfit(100, 2, 3, 'LONG');

      expect(takeProfit).toBe(106); // 100 + (2 * 3)
    });

    it('should calculate take profit for short position', () => {
      const takeProfit = calculator.calculateTakeProfit(100, 2, 3, 'SHORT');

      expect(takeProfit).toBe(94); // 100 - (2 * 3)
    });

    it('should handle different multipliers', () => {
      const takeProfit1 = calculator.calculateTakeProfit(100, 2, 2, 'LONG');
      const takeProfit2 = calculator.calculateTakeProfit(100, 2, 4, 'LONG');

      expect(takeProfit1).toBe(104);
      expect(takeProfit2).toBe(108);
    });
  });

  describe('edge cases', () => {
    it('should handle flat prices', () => {
      const highs = Array.from({ length: 20 }, () => 100);
      const lows = Array.from({ length: 20 }, () => 100);
      const closes = Array.from({ length: 20 }, () => 100);

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.value).toBe(0);
      expect(result!.percentOfPrice).toBe(0);
    });

    it('should handle gaps', () => {
      const highs = [100, 110, 105, 115, 108];
      const lows = [95, 105, 100, 110, 103];
      const closes = [98, 108, 103, 113, 106];

      // Add more data to meet minimum requirement
      for (let i = 0; i < 15; i++) {
        highs.push(105);
        lows.push(95);
        closes.push(100);
      }

      const result = calculator.calculate(highs, lows, closes);

      expect(result).not.toBeNull();
      expect(result!.value).toBeGreaterThan(0);
    });
  });
});
