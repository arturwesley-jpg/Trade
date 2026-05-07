import PDFDocument from 'pdfkit';
import { TaxReport } from '../types.js';
import { Writable } from 'stream';

/**
 * PDF Export for tax reports
 */

export class PDFExporter {
  /**
   * Export tax report to PDF
   */
  async exportReport(report: TaxReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });

      // Collect PDF chunks
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(20).text('Cryptocurrency Tax Report', { align: 'center' });
      doc.moveDown();

      // Report details
      doc.fontSize(12);
      doc.text(`Tax Year: ${report.year}`);
      doc.text(`Jurisdiction: ${report.jurisdiction}`);
      doc.text(`Cost Basis Method: ${report.method.toUpperCase()}`);
      doc.text(`Currency: ${report.fiatCurrency}`);
      doc.text(`Generated: ${report.generatedAt.toLocaleString()}`);
      doc.moveDown();

      // Summary section
      doc.fontSize(16).text('Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);

      const summary = report.summary;
      doc.text(`Short-term Capital Gains: ${this.formatCurrency(summary.shortTermGains, report.fiatCurrency)}`);
      doc.text(`Short-term Capital Losses: ${this.formatCurrency(summary.shortTermLosses, report.fiatCurrency)}`);
      doc.text(`Long-term Capital Gains: ${this.formatCurrency(summary.longTermGains, report.fiatCurrency)}`);
      doc.text(`Long-term Capital Losses: ${this.formatCurrency(summary.longTermLosses, report.fiatCurrency)}`);
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Net Capital Gain/Loss: ${this.formatCurrency(summary.netGainLoss, report.fiatCurrency)}`, { bold: true });
      doc.fontSize(11).text(`Ordinary Income: ${this.formatCurrency(summary.ordinaryIncome, report.fiatCurrency)}`);
      doc.moveDown();

      // Transactions section
      if (report.transactions.length > 0) {
        doc.addPage();
        doc.fontSize(16).text('Capital Gains/Losses Transactions', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(9);

        // Table header
        const tableTop = doc.y;
        const colWidths = [60, 50, 50, 70, 70, 60, 40];
        const headers = ['Date', 'Asset', 'Amount', 'Cost Basis', 'Proceeds', 'Gain/Loss', 'Term'];

        let x = 50;
        headers.forEach((header, i) => {
          doc.text(header, x, tableTop, { width: colWidths[i], bold: true });
          x += colWidths[i];
        });

        doc.moveDown();

        // Table rows
        for (const tx of report.transactions.slice(0, 50)) { // Limit to 50 for PDF size
          const y = doc.y;
          x = 50;

          const values = [
            tx.disposedDate?.toLocaleDateString() || '',
            tx.asset,
            tx.amount.toFixed(4),
            this.formatCurrency(tx.costBasis || 0, report.fiatCurrency),
            this.formatCurrency(tx.proceeds || 0, report.fiatCurrency),
            this.formatCurrency(tx.gainLoss || 0, report.fiatCurrency),
            tx.isShortTerm ? 'ST' : 'LT',
          ];

          values.forEach((value, i) => {
            doc.text(value, x, y, { width: colWidths[i] });
            x += colWidths[i];
          });

          doc.moveDown(0.3);

          // Add new page if needed
          if (doc.y > 700) {
            doc.addPage();
            doc.fontSize(9);
          }
        }

        if (report.transactions.length > 50) {
          doc.moveDown();
          doc.text(`... and ${report.transactions.length - 50} more transactions. See CSV export for complete list.`);
        }
      }

      // Income section
      if (report.incomeTransactions.length > 0) {
        doc.addPage();
        doc.fontSize(16).text('Income Transactions', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(9);

        for (const tx of report.incomeTransactions) {
          doc.text(`${tx.date.toLocaleDateString()} - ${tx.type}: ${tx.amount} ${tx.asset} = ${this.formatCurrency(tx.proceeds || 0, report.fiatCurrency)}`);
          doc.moveDown(0.3);
        }
      }

      // Unrealized gains section
      if (report.unrealizedGains.length > 0) {
        doc.addPage();
        doc.fontSize(16).text('Unrealized Gains/Losses', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(9);

        for (const ug of report.unrealizedGains) {
          doc.text(
            `${ug.asset}: ${ug.amount.toFixed(4)} - Cost Basis: ${this.formatCurrency(ug.costBasis, report.fiatCurrency)}, ` +
            `Current Value: ${this.formatCurrency(ug.currentValue, report.fiatCurrency)}, ` +
            `Unrealized: ${this.formatCurrency(ug.unrealizedGain, report.fiatCurrency)}`
          );
          doc.moveDown(0.3);
        }
      }

      // Disclaimer
      doc.addPage();
      doc.fontSize(14).text('DISCLAIMER', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).text(report.disclaimer, { align: 'justify' });

      doc.end();
    });
  }

  /**
   * Format currency value
   */
  private formatCurrency(value: number, currency: string): string {
    return `${currency} ${value.toFixed(2)}`;
  }
}
