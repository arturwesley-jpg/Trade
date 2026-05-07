import { describe, it, expect, beforeEach } from 'vitest';
import { CostBasisCalculator } from '../cost-basis.js';
import { Transaction } from '../types.js';

describe('CostBasisCalculator', () => {
  let calculator: CostBasisCalculator;

  beforeEach(() => {
    calculator = new CostBasisCalculator('fifo');
  });

  describe('FIFO Method', () => {
    it('should calculate cost basis using FIFO', () => {
      const transactions: Transaction[] = [
        {
          id: '1',
          timestamp: new Date('2024-01-01'),
          type: 'buy',
          asset: 'BTC',
          amount: 1,
          price: 40000,
          fiatCurrency: 'USD',
        },
        {
          id: '2',
          timestamp: new Date('2024-02-01'),
          type: 'buy',
          asset: 'BTC',
          amount: 1,
          price: 50000,
          fiatCurrency: 'USD',
        },
      ];

      transactions.forEach(tx => calculator.addLot(tx));

      const disposed = calculator.disposeLots('BTC', 1);

      expect(disposed).toHaveLength(1);
      expect(disposed[0].costBasis).toBe(40000);
      expect(disposed[0].lot.acquiredDate).toEqual(new Date('2024-01-01'));
    });

    it('should handle partial lot disposal', () => {
      calculator.addLot({
        id: '1',
        timestamp: new Date('2024-01-01'),
        type: 'buy',
        asset: 'BTC',
        amount: 2,
        price: 40000,
        fiatCurrency: 'USD',
      });

      const disposed = calculator.disposeLots('BTC', 0.5);

      expect(disposed).toHaveLength(1);
      expect(disposed[0].amountUsed).toBe(0.5);
      expect(disposed[0].costBasis).toBe(40000); // 0.5 * 80000 / 2

      const remaining = calculator.getRemainingLots('BTC');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].amount).toBe(1.5);
    });

    it('should handle multiple lot disposal', () => {
      calculator.addLot({
        id: '1',
        timestamp: new Date('2024-01-01'),
        type: 'buy',
        asset: 'BTC',
        amount: 1,
        price: 40000,
        fiatCurrency: 'USD',
      });

      calculator.addLot({
        id: '2',
        timestamp: new Date('2024-02-01'),
        type: 'buy',
        asset: 'BTC',
        amount: 1,
        price: 50000,
        fiatCurrency: 'USD',
      });

      const disposed = calculator.disposeLots('BTC', 1.5);

      expect(disposed).toHaveLength(2);
      expect(disposed[0].amountUsed).toBe(1);
      expect(disposed[0].costBasis).toBe(40000);
      expect(disposed[1].amountUsed).toBe(0.5);
      expect(disposed[1].costBasis).toBe(25000);
    });
  });

  describe('LIFO Method', () => {
    beforeEach(() => {
      calculator = new CostBasisCalculator('lifo');
    });

    it('should calculate cost basis using LIFO', () => {
      calculator.addLot({
        id: '1',
        timestamp: new Date('2024-01-01'),
        type: 'buy',
        asset: 'BTC',
        amount: 1,
        price: 40000,
        fiatCurrency: 'USD',
      });

      calculator.addLot({
        id: '2',
        timestamp: new Date('2024-02-01'),
        type: 'buy',
        asset: 'BTC',
        amount: 1,
        price: 50000,
        fiatCurrency: 'USD',
      });

      const disposed = calculator.disposeLots('BTC', 1);

      expect(disposed).toHaveLength(1);
      expect(disposed[0].costBasis).toBe(50000);
      expect(disposed[0].lot.acquiredDate).toEqual(new Date('2024-02-01'));
    });
  });

  describe('HIFO Method', () => {
    beforeEach(() => {
      calculator = new CostBasisCalculator('hifo');
    });

    it('should calculate cost basis using HIFO', () => {
      calculator.addLot({
        id: '1',
        timestamp: new Date('2024-01-01'),
        type: 'buy',
        asset: 'BTC',
        amount: 1,
        price: 40000,
        fiatCurrency: 'USD',
      });

      calculator.addLot({
        id: '2',
        timestamp: new Date('2024-02-01'),
        type: 'buy',
        asset: 'BTC',
        amount: 1,
        price: 50000,
        fiatCurrency: 'USD',
      });

      calculator.addLot({
        id: '3',
        timestamp: new Date('2024-03-01'),
        type: 'buy',
        asset: 'BTC',
        amount: 1,
        price: 45000,
        fiatCurrency: 'USD',
      });

      const disposed = calculator.disposeLots('BTC', 1);

      expect(disposed).toHaveLength(1);
      expect(disposed[0].costBasis).toBe(50000); // Highest cost basis
    });
  });

  describe('Income Transactions', () => {
    it('should add staking rewards as lots', () => {
      calculator.addLot({
        id: '1',
        timestamp: new Date('2024-01-01'),
        type: 'staking-reward',
        asset: 'ETH',
        amount: 0.5,
        price: 3000,
        fiatCurrency: 'USD',
      });

      const lots = calculator.getRemainingLots('ETH');
      expect(lots).toHaveLength(1);
      expect(lots[0].amount).toBe(0.5);
      expect(lots[0].costBasis).toBe(1500);
    });

    it('should add airdrops as lots', () => {
      calculator.addLot({
        id: '1',
        timestamp: new Date('2024-01-01'),
        type: 'airdrop',
        asset: 'TOKEN',
        amount: 100,
        price: 10,
        fiatCurrency: 'USD',
      });

      const lots = calculator.getRemainingLots('TOKEN');
      expect(lots).toHaveLength(1);
      expect(lots[0].costBasis).toBe(1000);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when disposing more than available', () => {
      calculator.addLot({
        id: '1',
        timestamp: new Date('2024-01-01'),
        type: 'buy',
        asset: 'BTC',
        amount: 1,
        price: 40000,
        fiatCurrency: 'USD',
      });

      expect(() => calculator.disposeLots('BTC', 2)).toThrow();
    });

    it('should throw error when disposing non-existent asset', () => {
      expect(() => calculator.disposeLots('ETH', 1)).toThrow();
    });
  });

  describe('Multiple Assets', () => {
    it('should track multiple assets independently', () => {
      calculator.addLot({
        id: '1',
        timestamp: new Date('2024-01-01'),
        type: 'buy',
        asset: 'BTC',
        amount: 1,
        price: 40000,
        fiatCurrency: 'USD',
      });

      calculator.addLot({
        id: '2',
        timestamp: new Date('2024-01-01'),
        type: 'buy',
        asset: 'ETH',
        amount: 10,
        price: 3000,
        fiatCurrency: 'USD',
      });

      expect(calculator.getTotalAmount('BTC')).toBe(1);
      expect(calculator.getTotalAmount('ETH')).toBe(10);
      expect(calculator.getTotalCostBasis('BTC')).toBe(40000);
      expect(calculator.getTotalCostBasis('ETH')).toBe(30000);
    });
  });
});
