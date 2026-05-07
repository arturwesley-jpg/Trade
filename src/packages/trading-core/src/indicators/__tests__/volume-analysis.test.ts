import { describe, it, expect } from 'vitest';
import { VolumeAnalysisCalculator } from '../volume-analysis';

describe('VolumeAnalysisCalculator', () => {
  describe('Basic Volume Analysis', () => {
    it('should calculate volume analysis correctly', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10 });

      const closes = [100, 102, 104, 103, 105, 107, 106, 108, 110, 112, 115];
      const volumes = [1000, 1100, 1200, 900, 1300, 1400, 1000, 1500, 1600, 1700, 2000];

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.currentVolume).toBe(2000);
      expect(result!.averageVolume).toBeGreaterThan(0);
      expect(result!.volumeRatio).toBeGreaterThan(1); // Current volume higher than average
    });

    it('should return null for insufficient data', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 20 });

      const closes = [100, 102, 104];
      const volumes = [1000, 1100, 1200];

      const result = calculator.calculate(closes, volumes);

      expect(result).toBeNull();
    });

    it('should return null for mismatched array lengths', () => {
      const calculator = new VolumeAnalysisCalculator();

      const closes = [100, 102, 104, 106, 108];
      const volumes = [1000, 1100, 1200];

      const result = calculator.calculate(closes, volumes);

      expect(result).toBeNull();
    });
  });

  describe('Volume Trend Detection', () => {
    it('should detect INCREASING volume trend', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10, trendPeriod: 10 });

      const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
      const volumes = Array.from({ length: 30 }, (_, i) => 1000 + i * 100);

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.volumeTrend).toBe('INCREASING');
    });

    it('should detect DECREASING volume trend', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10, trendPeriod: 10 });

      const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
      const volumes = Array.from({ length: 30 }, (_, i) => 3000 - i * 50);

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.volumeTrend).toBe('DECREASING');
    });

    it('should detect STABLE volume trend', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10, trendPeriod: 10 });

      const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
      const volumes = Array(30).fill(1000);

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.volumeTrend).toBe('STABLE');
    });
  });

  describe('Signal Generation', () => {
    it('should generate ACCUMULATION signal', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10, trendPeriod: 10 });

      // Rising prices with increasing volume
      const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
      const volumes = Array.from({ length: 30 }, (_, i) => 1000 + i * 100);

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.signal).toBe('ACCUMULATION');
    });

    it('should generate DISTRIBUTION signal', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10, trendPeriod: 10 });

      // Falling prices with increasing volume
      const closes = Array.from({ length: 30 }, (_, i) => 200 - i * 2);
      const volumes = Array.from({ length: 30 }, (_, i) => 1000 + i * 100);

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.signal).toBe('DISTRIBUTION');
    });

    it('should generate NEUTRAL signal', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10, trendPeriod: 10 });

      // Sideways prices with stable volume
      const closes = Array.from({ length: 30 }, () => 100);
      const volumes = Array(30).fill(1000);

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.signal).toBe('NEUTRAL');
    });
  });

  describe('Volume Price Trend (VPT)', () => {
    it('should calculate positive VPT for uptrend', () => {
      const calculator = new VolumeAnalysisCalculator();

      const closes = [100, 105, 110, 115, 120];
      const volumes = [1000, 1100, 1200, 1300, 1400];

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.volumePriceTrend).toBeGreaterThan(0);
    });

    it('should calculate negative VPT for downtrend', () => {
      const calculator = new VolumeAnalysisCalculator();

      const closes = [120, 115, 110, 105, 100];
      const volumes = [1000, 1100, 1200, 1300, 1400];

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.volumePriceTrend).toBeLessThan(0);
    });
  });

  describe('OHLCV Analysis', () => {
    it('should calculate with full OHLCV data', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10 });

      const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
      const highs = Array.from({ length: 30 }, (_, i) => 105 + i);
      const lows = Array.from({ length: 30 }, (_, i) => 95 + i);
      const volumes = Array.from({ length: 30 }, (_, i) => 1000 + i * 50);

      const result = calculator.calculateWithOHLCV(closes, highs, lows, volumes);

      expect(result).not.toBeNull();
      expect(result!.accumulationDistribution).toBeDefined();
    });

    it('should return null for mismatched OHLCV lengths', () => {
      const calculator = new VolumeAnalysisCalculator();

      const closes = [100, 102, 104];
      const highs = [105, 107];
      const lows = [95, 97, 99];
      const volumes = [1000, 1100, 1200];

      const result = calculator.calculateWithOHLCV(closes, highs, lows, volumes);

      expect(result).toBeNull();
    });
  });

  describe('Volume Spike Detection', () => {
    it('should detect volume spike', () => {
      const calculator = new VolumeAnalysisCalculator({
        averagePeriod: 10,
        highVolumeThreshold: 2.0
      });

      const volumes = [...Array(20).fill(1000), 3000]; // Spike at end

      const hasSpike = calculator.detectVolumeSpike(volumes);

      expect(hasSpike).toBe(true);
    });

    it('should not detect spike for normal volume', () => {
      const calculator = new VolumeAnalysisCalculator({
        averagePeriod: 10,
        highVolumeThreshold: 2.0
      });

      const volumes = Array(21).fill(1000);

      const hasSpike = calculator.detectVolumeSpike(volumes);

      expect(hasSpike).toBe(false);
    });
  });

  describe('Volume Dryup Detection', () => {
    it('should detect volume dryup', () => {
      const calculator = new VolumeAnalysisCalculator({
        averagePeriod: 10,
        lowVolumeThreshold: 0.5
      });

      const volumes = [...Array(20).fill(1000), 300]; // Dryup at end

      const hasDryup = calculator.detectVolumeDryup(volumes);

      expect(hasDryup).toBe(true);
    });

    it('should not detect dryup for normal volume', () => {
      const calculator = new VolumeAnalysisCalculator({
        averagePeriod: 10,
        lowVolumeThreshold: 0.5
      });

      const volumes = Array(21).fill(1000);

      const hasDryup = calculator.detectVolumeDryup(volumes);

      expect(hasDryup).toBe(false);
    });
  });

  describe('VWAP Calculation', () => {
    it('should calculate VWAP correctly', () => {
      const calculator = new VolumeAnalysisCalculator();

      const closes = [100, 110, 120];
      const volumes = [1000, 2000, 1000];

      const vwap = calculator.calculateVWAP(closes, volumes);

      expect(vwap).not.toBeNull();
      // VWAP = (100*1000 + 110*2000 + 120*1000) / (1000+2000+1000)
      // VWAP = (100000 + 220000 + 120000) / 4000 = 440000 / 4000 = 110
      expect(vwap).toBe(110);
    });

    it('should return null for empty arrays', () => {
      const calculator = new VolumeAnalysisCalculator();

      const vwap = calculator.calculateVWAP([], []);

      expect(vwap).toBeNull();
    });

    it('should return null for mismatched lengths', () => {
      const calculator = new VolumeAnalysisCalculator();

      const closes = [100, 110];
      const volumes = [1000];

      const vwap = calculator.calculateVWAP(closes, volumes);

      expect(vwap).toBeNull();
    });
  });

  describe('Price-Volume Confirmation', () => {
    it('should confirm strong price move with high volume', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10 });

      // Significant price increase with high volume
      const closes = [...Array(20).fill(100), 105]; // 5% increase
      const volumes = [...Array(20).fill(1000), 2000]; // 2x volume

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.priceVolumeConfirmation).toBe(true);
    });

    it('should not confirm weak price move', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10 });

      // Small price change
      const closes = [...Array(20).fill(100), 100.5]; // 0.5% increase
      const volumes = [...Array(20).fill(1000), 2000];

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.priceVolumeConfirmation).toBe(false);
    });

    it('should not confirm price move with low volume', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10 });

      // Significant price increase but low volume
      const closes = [...Array(20).fill(100), 105]; // 5% increase
      const volumes = [...Array(20).fill(1000), 800]; // Below average

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.priceVolumeConfirmation).toBe(false);
    });
  });

  describe('Strength Calculation', () => {
    it('should calculate strength based on volume ratio', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10 });

      const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
      const volumes = [...Array(29).fill(1000), 2000]; // 2x average

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.strength).toBeGreaterThan(0);
      expect(result!.strength).toBeLessThanOrEqual(1);
    });

    it('should cap strength at 1.0', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10 });

      const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
      const volumes = [...Array(29).fill(1000), 10000]; // 10x average

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.strength).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero volumes', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10 });

      const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
      const volumes = Array(30).fill(0);

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.volumeRatio).toBe(1); // Default when average is 0
    });

    it('should handle single data point', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 1 });

      const closes = [100];
      const volumes = [1000];

      const result = calculator.calculate(closes, volumes);

      expect(result).toBeNull(); // Need at least 2 points for price change
    });

    it('should handle all same volumes', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 10 });

      const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
      const volumes = Array(30).fill(1000);

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
      expect(result!.volumeTrend).toBe('STABLE');
      expect(result!.volumeRatio).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should use custom average period', () => {
      const calculator = new VolumeAnalysisCalculator({ averagePeriod: 5 });

      const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
      const volumes = Array.from({ length: 20 }, (_, i) => 1000 + i * 50);

      const result = calculator.calculate(closes, volumes);

      expect(result).not.toBeNull();
    });

    it('should use custom thresholds', () => {
      const calculator = new VolumeAnalysisCalculator({
        highVolumeThreshold: 3.0,
        lowVolumeThreshold: 0.3
      });

      const volumes = [...Array(20).fill(1000), 4000];

      const hasSpike = calculator.detectVolumeSpike(volumes);

      expect(hasSpike).toBe(true);
    });
  });
});
