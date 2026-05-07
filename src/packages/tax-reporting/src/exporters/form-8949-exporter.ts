import { TaxReport, TaxTransaction } from '../types.js';

/**
 * IRS Form 8949 Exporter
 * Sales and Other Dispositions of Capital Assets
 *
 * DISCLAIMER: This is a simplified representation of Form 8949.
 * Consult with a tax professional for accurate filing.
 */

export interface Form8949Data {
  shortTermTransactions: Form8949Transaction[];
  longTermTransactions: Form8949Transaction[];
  shortTermTotals: Form8949Totals;
  longTermTotals: Form8949Totals;
}

export interface Form8949Transaction {
  description: string; // (a) Description of property
  dateAcquired: string; // (b) Date acquired
  dateSold: string; // (c) Date sold or disposed
  proceeds: number; // (d) Proceeds (sales price)
  costBasis: number; // (e) Cost or other basis
  adjustmentCode?: string; // (f) Code(s) from instructions
  adjustmentAmount?: number; // (g) Amount of adjustment
  gainOrLoss: number; // (h) Gain or (loss)
}

export interface Form8949Totals {
  totalProceeds: number;
  totalCostBasis: number;
  totalAdjustments: number;
  totalGainLoss: number;
}

export class Form8949Exporter {
  /**
   * Generate Form 8949 data from tax report
   */
  generateForm8949(report: TaxReport): Form8949Data {
    if (report.jurisdiction !== 'US') {
      throw new Error('Form 8949 is only applicable for US jurisdiction');
    }

    const shortTermTransactions: Form8949Transaction[] = [];
    const longTermTransactions: Form8949Transaction[] = [];

    for (const tx of report.transactions) {
      const form8949Tx = this.convertToForm8949Transaction(tx);

      if (tx.isShortTerm) {
        shortTermTransactions.push(form8949Tx);
      } else {
        longTermTransactions.push(form8949Tx);
      }
    }

    return {
      shortTermTransactions,
      longTermTransactions,
      shortTermTotals: this.calculateTotals(shortTermTransactions),
      longTermTotals: this.calculateTotals(longTermTransactions),
    };
  }

  /**
   * Convert tax transaction to Form 8949 format
   */
  private convertToForm8949Transaction(tx: TaxTransaction): Form8949Transaction {
    return {
      description: `${tx.amount} ${tx.asset}`,
      dateAcquired: tx.acquiredDate?.toLocaleDateString('en-US') || 'VARIOUS',
      dateSold: tx.disposedDate?.toLocaleDateString('en-US') || tx.date.toLocaleDateString('en-US'),
      proceeds: tx.proceeds || 0,
      costBasis: tx.costBasis || 0,
      adjustmentCode: undefined,
      adjustmentAmount: undefined,
      gainOrLoss: tx.gainLoss || 0,
    };
  }

  /**
   * Calculate totals for Form 8949
   */
  private calculateTotals(transactions: Form8949Transaction[]): Form8949Totals {
    return {
      totalProceeds: transactions.reduce((sum, tx) => sum + tx.proceeds, 0),
      totalCostBasis: transactions.reduce((sum, tx) => sum + tx.costBasis, 0),
      totalAdjustments: transactions.reduce((sum, tx) => sum + (tx.adjustmentAmount || 0), 0),
      totalGainLoss: transactions.reduce((sum, tx) => sum + tx.gainOrLoss, 0),
    };
  }

  /**
   * Export Form 8949 as CSV
   */
  exportAsCSV(form8949Data: Form8949Data, term: 'short' | 'long'): string {
    const transactions = term === 'short'
      ? form8949Data.shortTermTransactions
      : form8949Data.longTermTransactions;

    const totals = term === 'short'
      ? form8949Data.shortTermTotals
      : form8949Data.longTermTotals;

    let csv = 'Description,Date Acquired,Date Sold,Proceeds,Cost Basis,Adjustment Code,Adjustment Amount,Gain/Loss\n';

    for (const tx of transactions) {
      csv += `"${tx.description}",${tx.dateAcquired},${tx.dateSold},${tx.proceeds.toFixed(2)},${tx.costBasis.toFixed(2)},${tx.adjustmentCode || ''},${tx.adjustmentAmount?.toFixed(2) || ''},${tx.gainOrLoss.toFixed(2)}\n`;
    }

    // Add totals row
    csv += `TOTALS,,,${totals.totalProceeds.toFixed(2)},${totals.totalCostBasis.toFixed(2)},,${totals.totalAdjustments.toFixed(2)},${totals.totalGainLoss.toFixed(2)}\n`;

    return csv;
  }

  /**
   * Export Form 8949 as text format
   */
  exportAsText(form8949Data: Form8949Data): string {
    let text = 'IRS FORM 8949 - Sales and Other Dispositions of Capital Assets\n';
    text += '='.repeat(80) + '\n\n';

    // Short-term section
    text += 'PART I - SHORT-TERM CAPITAL GAINS AND LOSSES\n';
    text += '-'.repeat(80) + '\n';
    text += this.formatTransactionsAsText(form8949Data.shortTermTransactions);
    text += '\nShort-term Totals:\n';
    text += this.formatTotalsAsText(form8949Data.shortTermTotals);
    text += '\n\n';

    // Long-term section
    text += 'PART II - LONG-TERM CAPITAL GAINS AND LOSSES\n';
    text += '-'.repeat(80) + '\n';
    text += this.formatTransactionsAsText(form8949Data.longTermTransactions);
    text += '\nLong-term Totals:\n';
    text += this.formatTotalsAsText(form8949Data.longTermTotals);

    return text;
  }

  /**
   * Format transactions as text
   */
  private formatTransactionsAsText(transactions: Form8949Transaction[]): string {
    let text = '';

    for (const tx of transactions) {
      text += `${tx.description}\n`;
      text += `  Acquired: ${tx.dateAcquired} | Sold: ${tx.dateSold}\n`;
      text += `  Proceeds: $${tx.proceeds.toFixed(2)} | Cost Basis: $${tx.costBasis.toFixed(2)} | Gain/Loss: $${tx.gainOrLoss.toFixed(2)}\n\n`;
    }

    return text;
  }

  /**
   * Format totals as text
   */
  private formatTotalsAsText(totals: Form8949Totals): string {
    return `  Total Proceeds: $${totals.totalProceeds.toFixed(2)}\n` +
           `  Total Cost Basis: $${totals.totalCostBasis.toFixed(2)}\n` +
           `  Total Adjustments: $${totals.totalAdjustments.toFixed(2)}\n` +
           `  Total Gain/Loss: $${totals.totalGainLoss.toFixed(2)}\n`;
  }
}
