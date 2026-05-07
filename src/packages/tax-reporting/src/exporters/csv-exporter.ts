import { stringify } from 'csv-stringify/sync';
import { TaxReport, TaxTransaction } from '../types.js';

/**
 * CSV Export for tax reports
 * Compatible with TurboTax, TaxAct, and other tax software
 */

export class CSVExporter {
  /**
   * Export tax report to CSV format
   */
  exportReport(report: TaxReport, format: 'standard' | 'turbotax' | 'taxact' = 'standard'): string {
    switch (format) {
      case 'turbotax':
        return this.exportTurboTax(report);
      case 'taxact':
        return this.exportTaxAct(report);
      default:
        return this.exportStandard(report);
    }
  }

  /**
   * Standard CSV export
   */
  private exportStandard(report: TaxReport): string {
    const records = report.transactions.map(tx => ({
      Date: tx.date.toISOString().split('T')[0],
      Type: tx.type,
      Asset: tx.asset,
      Amount: tx.amount,
      'Acquired Date': tx.acquiredDate?.toISOString().split('T')[0] || '',
      'Disposed Date': tx.disposedDate?.toISOString().split('T')[0] || '',
      'Cost Basis': tx.costBasis?.toFixed(2) || '',
      Proceeds: tx.proceeds?.toFixed(2) || '',
      'Gain/Loss': tx.gainLoss?.toFixed(2) || '',
      'Term': tx.isShortTerm ? 'Short' : 'Long',
      Description: tx.description,
    }));

    return stringify(records, { header: true });
  }

  /**
   * TurboTax CSV format
   */
  private exportTurboTax(report: TaxReport): string {
    const records = report.transactions.map(tx => ({
      'Description of Property': `${tx.amount} ${tx.asset}`,
      'Date Acquired': tx.acquiredDate?.toLocaleDateString('en-US') || '',
      'Date Sold': tx.disposedDate?.toLocaleDateString('en-US') || '',
      'Proceeds': tx.proceeds?.toFixed(2) || '',
      'Cost Basis': tx.costBasis?.toFixed(2) || '',
      'Gain or Loss': tx.gainLoss?.toFixed(2) || '',
      'Type': tx.isShortTerm ? 'Short-term' : 'Long-term',
    }));

    return stringify(records, { header: true });
  }

  /**
   * TaxAct CSV format
   */
  private exportTaxAct(report: TaxReport): string {
    const records = report.transactions.map(tx => ({
      'Asset Name': tx.asset,
      'Purchase Date': tx.acquiredDate?.toLocaleDateString('en-US') || '',
      'Sale Date': tx.disposedDate?.toLocaleDateString('en-US') || '',
      'Sale Price': tx.proceeds?.toFixed(2) || '',
      'Cost Basis': tx.costBasis?.toFixed(2) || '',
      'Gain/Loss': tx.gainLoss?.toFixed(2) || '',
      'Term': tx.isShortTerm ? 'S' : 'L',
    }));

    return stringify(records, { header: true });
  }

  /**
   * Export income transactions
   */
  exportIncome(report: TaxReport): string {
    const records = report.incomeTransactions.map(tx => ({
      Date: tx.date.toISOString().split('T')[0],
      Type: tx.type,
      Asset: tx.asset,
      Amount: tx.amount,
      'Fair Market Value': tx.proceeds?.toFixed(2) || '',
      Description: tx.description,
    }));

    return stringify(records, { header: true });
  }

  /**
   * Export summary
   */
  exportSummary(report: TaxReport): string {
    const records = [
      { Category: 'Short-term Capital Gains', Amount: report.summary.shortTermGains.toFixed(2) },
      { Category: 'Short-term Capital Losses', Amount: report.summary.shortTermLosses.toFixed(2) },
      { Category: 'Long-term Capital Gains', Amount: report.summary.longTermGains.toFixed(2) },
      { Category: 'Long-term Capital Losses', Amount: report.summary.longTermLosses.toFixed(2) },
      { Category: 'Net Capital Gain/Loss', Amount: report.summary.netGainLoss.toFixed(2) },
      { Category: 'Ordinary Income', Amount: report.summary.ordinaryIncome.toFixed(2) },
    ];

    return stringify(records, { header: true });
  }

  /**
   * Export unrealized gains
   */
  exportUnrealizedGains(report: TaxReport): string {
    const records = report.unrealizedGains.map(ug => ({
      Asset: ug.asset,
      Amount: ug.amount,
      'Cost Basis': ug.costBasis.toFixed(2),
      'Current Value': ug.currentValue.toFixed(2),
      'Unrealized Gain/Loss': ug.unrealizedGain.toFixed(2),
    }));

    return stringify(records, { header: true });
  }
}
