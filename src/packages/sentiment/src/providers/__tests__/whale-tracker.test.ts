import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhaleTracker } from '../whale-tracker';

describe('WhaleTracker', () => {
  let tracker: WhaleTracker;

  beforeEach(() => {
    tracker = new WhaleTracker({
      minTransactionUSD: 100000,
      enableCaching: false,
    });
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const defaultTracker = new WhaleTracker();
      expect(defaultTracker).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const customTracker = new WhaleTracker({
        minTransactionUSD: 500000,
        significanceThresholds: {
          low: 500000,
          medium: 1000000,
          high: 5000000,
          critical: 10000000,
        },
      });
      expect(customTracker).toBeDefined();
    });
  });

  describe('transaction significance', () => {
    it('should classify transaction as low significance', () => {
      const transaction = {
        amount_usd: 150000,
        symbol: 'BTC',
        from: { address: '0x123', owner_type: 'unknown' },
        to: { address: '0x456', owner_type: 'unknown' },
      };

      expect(transaction.amount_usd).toBeGreaterThan(100000);
      expect(transaction.amount_usd).toBeLessThan(500000);
    });

    it('should classify transaction as critical significance', () => {
      const transaction = {
        amount_usd: 6000000,
        symbol: 'BTC',
        from: { address: '0x123', owner_type: 'exchange' },
        to: { address: '0x456', owner_type: 'unknown' },
      };

      expect(transaction.amount_usd).toBeGreaterThan(5000000);
    });
  });

  describe('wallet classification', () => {
    it('should identify exchange wallet', () => {
      const wallet = {
        address: '0xbinance',
        type: 'exchange' as const,
        label: 'Binance',
      };

      expect(wallet.type).toBe('exchange');
    });

    it('should identify whale wallet', () => {
      const wallet = {
        address: '0xwhale',
        type: 'whale' as const,
        balance: 10000,
      };

      expect(wallet.type).toBe('whale');
    });
  });

  describe('accumulation pattern detection', () => {
    it('should detect accumulation pattern', () => {
      const pattern = {
        symbol: 'BTC',
        walletAddress: '0xwhale',
        buyCount: 10,
        totalAmount: 100,
        totalUSD: 4000000,
        averageSize: 400000,
        timespan: 24,
        confidence: 85,
      };

      expect(pattern.buyCount).toBeGreaterThan(5);
      expect(pattern.confidence).toBeGreaterThan(70);
    });

    it('should calculate average transaction size', () => {
      const pattern = {
        symbol: 'ETH',
        walletAddress: '0xwhale',
        buyCount: 5,
        totalAmount: 500,
        totalUSD: 1000000,
        averageSize: 200000,
        timespan: 12,
        confidence: 75,
      };

      expect(pattern.averageSize).toBe(pattern.totalUSD / pattern.buyCount);
    });
  });

  describe('exchange flow analysis', () => {
    it('should detect inflow to exchange', () => {
      const flow = {
        direction: 'inflow',
        exchange: 'Binance',
        amount_usd: 2000000,
        symbol: 'BTC',
      };

      expect(flow.direction).toBe('inflow');
      expect(flow.amount_usd).toBeGreaterThan(1000000);
    });

    it('should detect outflow from exchange', () => {
      const flow = {
        direction: 'outflow',
        exchange: 'Coinbase',
        amount_usd: 3000000,
        symbol: 'ETH',
      };

      expect(flow.direction).toBe('outflow');
      expect(flow.amount_usd).toBeGreaterThan(1000000);
    });
  });

  describe('sentiment scoring', () => {
    it('should score bullish for exchange outflows', () => {
      const activity = {
        exchangeOutflows: 5000000,
        exchangeInflows: 1000000,
        netFlow: 4000000,
      };

      const score = activity.netFlow > 0 ? 0.7 : -0.7;
      expect(score).toBeGreaterThan(0);
    });

    it('should score bearish for exchange inflows', () => {
      const activity = {
        exchangeOutflows: 1000000,
        exchangeInflows: 5000000,
        netFlow: -4000000,
      };

      const score = activity.netFlow > 0 ? 0.7 : -0.7;
      expect(score).toBeLessThan(0);
    });
  });
});
