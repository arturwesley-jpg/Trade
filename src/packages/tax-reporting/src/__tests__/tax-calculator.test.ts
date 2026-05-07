import { describe, it, expect } from 'vitest';
import { TaxCalculator } from '../tax-calculator.js';
import { Transaction } from '../types.js';

describe('TaxCalculator', () => {
  describe('US Jurisdiction', () => {
    it('should generate tax report for a year', async () => {
      const calculator = new TaxCalculator('fifo', 'US', 'USD');

      const transactions: Transaction[] = [
        {
          id: '1',
          timestamp: new Date('2024-01-15'),
          type: 'buy',
          asset: 'BTC',
          amount: 1,
          price: 40000,
          fiatCurrency: 'USD',
        },
        {
          id: '2',
          timestamp: new Date('2024-06-15'),
          type: 'sell',
          asset: 'BTC',
          amount: 1,
          price: 60000,
          fiatCurrency: 'USD',
        },
      ];

      const report = await calculator.generateReport(transactions, 2024);

      expect(report.year).toBe(2024);
      expect(report.jurisdiction).toBe('US');
      expect(report.method).toBe('fifo');
      expect(report.transactions).toHaveLength(1);
      expect(report.summary.netGainLoss).toBe(20000);
      expect(report.transactions[0].isShortTerm).toBe(true);
    });

    it('should distinguish short-term and long-term gains', async () => {
      const calculator = new TaxCalculator('fifo', 'US', 'USD');

      const transactions: Transaction[] = [
        {
          id: '1',
          timestamp: new Date('2023-01-01'),
          type: 'buy',
          asset: 'BTC',
          amount: 1,
          price: 30000,
          fiatCurrency: 'USD',
        },
        {
          id: '2',
          timestamp: new Date('2024-06-01'),
          type: 'sell',
          asset: 'BTC',
          amount: 1,
          price: 60000,
          fiatCurrency: 'USD',
        },
      ];

      const report = await calculator.generateReport(transactions, 2024);

      expect(report.transactions[0].isShortTerm).toBe(false); // > 365 days
      expect(report.summary.longTermGains).toBe(30000);
      expect(report.summary.shortTermGains).toBe(0);
    });

    it('should track income from staking', async () => {
      const calculator = new TaxCalculator('fifo', 'US', 'USD');

      const transactions: Transaction[] = [
        {
          id: '1',
          timestamp: new Date('2024-01-15'),
          type: 'staking-reward',
          asset: 'ETH',
          amount: 0.5,
          price: 3000,
          fiatCurrency: 'USD',
        },
      ];

      const report = await calculator.generateReport(transactions, 2024);

      expect(report.incomeTransactions).toHaveLength(1);
      expect(report.summary.ordinaryIncome).toBe(1500);
    });

    it('should calculate unrealized gains', async () => {
      const calculator = new TaxCalculator('fifo', 'US', 'USD');

      const transactions: Transaction[] = [
        {
          id: '1',
          timestamp: new Date('2024-01-15'),
          type: 'buy',
          asset: 'BTC',
          amount: 1,
          price: 40000,
          fiatCurrency: 'USD',
        },
      ];

      const currentPrices = new Map([['BTC', 60000]]);

      const report = await calculator.generateReport(transactions, 2024, currentPrices);

      expect(report.unrealizedGains).toHaveLength(1);
      expect(report.unrealizedGains[0].asset).toBe('BTC');
      expect(report.unrealizedGains[0].unrealizedGain).toBe(20000);
    });
  });

  describe('Multiple Jurisdictions', () => {
    it('should handle UK tax year (April 6 start)', async () => {
      const calculator = new TaxCalculator('fifo', 'UK', 'GBP');

      const transactions: Transaction[] = [
        {
          id: '1',
          timestamp: new Date('2024-04-01'), // Before UK tax year
          type: 'buy',
          asset: 'BTC',
          amount: 1,
          price: 40000,
          fiatCurrency: 'GBP',
        },
        {
          id: '2',
          timestamp: new Date('2024-04-10'), // After UK tax year start
          type: 'sell',
          asset: 'BTC',
          amount: 1,
          price: 50000,
          fiatCurrency: 'GBP',
        },
      ];

      const report = await calculator.generateReport(transactions, 2024);

      // Only the sell should be in the 2024 tax year
      expect(report.transactions).toHaveLength(1);
    });

    it('should handle Australian tax year (July 1 start)', async () => {
      const calculator = new TaxCalculator('fifo', 'AU', 'AUD');

      const transactions: Transaction[] = [
        {
          id: '1',
          timestamp: new Date('2024-06-30'),
          type: 'buy',
          asset: 'BTC',
          amount: 1,
          price: 40000,
          fiatCurrency: 'AUD',
        },
        {
          id: '2',
          timestamp: new Date('2024-07-02'),
          type: 'sell',
          asset: 'BTC',
          amount: 1,
          price: 50000,
          fiatCurrency: 'AUD',
        },
      ];

      const report = await calculator.generateReport(transactions, 2024);

      // Only the sell should be in the 2024 tax year (starts July 1)
      expect(report.transactions).toHaveLength(1);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple buys and sells', async () => {
      const calculator = new TaxCalculator('fifo', 'US', 'USD');

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
          price: 45000,
          fiatCurrency: 'USD',
        },
        {
          id: '3',
          timestamp: new Date('2024-03-01'),
          type: 'sell',
          asset: 'BTC',
          amount: 0.5,
          price: 50000,
          fiatCurrency: 'USD',
        },
        {
          id: '4',
          timestamp: new Date('2024-04-01'),
          type: 'sell',
          asset: 'BTC',
          amount: 1,
          price: 55000,
          fiatCurrency: 'USD',
        },
      ];

      const report = await calculator.generateReport(transactions, 2024);

      expect(report.transactions).toHaveLength(2);
      expect(report.summary.totalGains).toBeGreaterThan(0);
    });

    it('should handle losses', async () => {
      const calculator = new TaxCalculator('fifo', 'US', 'USD');

      const transactions: Transaction[] = [
        {
          id: '1',
          timestamp: new Date('2024-01-01'),
          type: 'buy',
          asset: 'BTC',
          amount: 1,
          price: 60000,
          fiatCurrency: 'USD',
        },
        {
          id: '2',
          timestamp: new Date('2024-06-01'),
          type: 'sell',
          asset: 'BTC',
          amount: 1,
          price: 40000,
          fiatCurrency: 'USD',
        },
      ];

      const report = await calculator.generateReport(transactions, 2024);

      expect(report.summary.netGainLoss).toBe(-20000);
      expect(report.summary.totalLosses).toBe(20000);
    });
  });
});
