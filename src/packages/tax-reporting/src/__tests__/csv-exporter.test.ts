import { describe, it, expect } from 'vitest';
import { CSVExporter } from '../exporters/csv-exporter.js';
import { TaxReport } from '../types.js';

describe('CSVExporter', () => {
  const mockReport: TaxReport = {
    year: 2024,
    jurisdiction: 'US',
    method: 'fifo',
    fiatCurrency: 'USD',
    summary: {
      totalGains: 20000,
      totalLosses: 5000,
      netGainLoss: 15000,
      shortTermGains: 10000,
      shortTermLosses: 2000,
      longTermGains: 10000,
      longTermLosses: 3000,
      ordinaryIncome: 1500,
      totalFees: 100,
    },
    transactions: [
      {
        id: '1',
        date: new Date('2024-06-15'),
        type: 'sell',
        asset: 'BTC',
        amount: 1,
        proceeds: 60000,
        costBasis: 40000,
        gainLoss: 20000,
        isShortTerm: true,
        acquiredDate: new Date('2024-01-15'),
        disposedDate: new Date('2024-06-15'),
        description: 'Sell 1 BTC',
      },
    ],
    incomeTransactions: [],
    unrealizedGains: [],
    generatedAt: new Date('2024-12-31'),
    disclaimer: 'Test disclaimer',
  };

  it('should export standard CSV format', () => {
    const exporter = new CSVExporter();
    const csv = exporter.exportReport(mockReport, 'standard');

    expect(csv).toContain('Date,Type,Asset,Amount');
    expect(csv).toContain('BTC');
    expect(csv).toContain('60000');
    expect(csv).toContain('40000');
  });

  it('should export TurboTax format', () => {
    const exporter = new CSVExporter();
    const csv = exporter.exportReport(mockReport, 'turbotax');

    expect(csv).toContain('Description of Property');
    expect(csv).toContain('Date Acquired');
    expect(csv).toContain('Date Sold');
    expect(csv).toContain('Proceeds');
  });

  it('should export TaxAct format', () => {
    const exporter = new CSVExporter();
    const csv = exporter.exportReport(mockReport, 'taxact');

    expect(csv).toContain('Asset Name');
    expect(csv).toContain('Purchase Date');
    expect(csv).toContain('Sale Date');
  });

  it('should export summary', () => {
    const exporter = new CSVExporter();
    const csv = exporter.exportSummary(mockReport);

    expect(csv).toContain('Category,Amount');
    expect(csv).toContain('Short-term Capital Gains');
    expect(csv).toContain('15000.00');
  });
});
