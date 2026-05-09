import { Router } from 'express';
import {
  TaxCalculator,
  CSVExporter,
  PDFExporter,
  Form8949Exporter,
  Transaction,
  CostBasisMethod,
  Jurisdiction,
  ExportFormat,
} from '@trade/tax-reporting';
import { logger } from '@trade/shared/logger';

const router = Router();

/**
 * Tax Reporting API Routes
 *
 * DISCLAIMER: This API provides tax calculation tools for informational purposes only.
 * It does not constitute tax, legal, or financial advice. Users should consult with
 * qualified tax professionals regarding their specific tax situations.
 */

/**
 * GET /api/tax/report/:year
 * Generate tax report for a specific year
 */
router.get('/report/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const method = (req.query.method as CostBasisMethod) || 'fifo';
    const jurisdiction = (req.query.jurisdiction as Jurisdiction) || 'US';
    const fiatCurrency = (req.query.currency as string) || 'USD';

    if (isNaN(year) || year < 2009 || year > new Date().getFullYear()) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    // TODO: Fetch transactions from database
    // For now, return mock data
    const transactions: Transaction[] = [];

    const calculator = new TaxCalculator(method, jurisdiction, fiatCurrency);
    const report = await calculator.generateReport(transactions, year);

    res.json(report);
  } catch (error) {
    logger.error('Error generating tax report', { error: error instanceof Error ? error : undefined });
    res.status(500).json({ error: 'Failed to generate tax report' });
  }
});

/**
 * GET /api/tax/preview
 * Preview tax liability for current year
 */
router.get('/preview', async (req, res) => {
  try {
    const method = (req.query.method as CostBasisMethod) || 'fifo';
    const jurisdiction = (req.query.jurisdiction as Jurisdiction) || 'US';
    const fiatCurrency = (req.query.currency as string) || 'USD';

    const currentYear = new Date().getFullYear();

    // TODO: Fetch transactions from database
    const transactions: Transaction[] = [];

    const calculator = new TaxCalculator(method, jurisdiction, fiatCurrency);
    const report = await calculator.generateReport(transactions, currentYear);

    // Calculate preview
    const preview = {
      estimatedTaxLiability: 0, // Would need tax rates to calculate
      shortTermGains: report.summary.shortTermGains,
      longTermGains: report.summary.longTermGains,
      ordinaryIncome: report.summary.ordinaryIncome,
      totalFees: report.summary.totalFees,
      netGainLoss: report.summary.netGainLoss,
      notes: [
        'This is an estimate based on current transactions.',
        'Actual tax liability depends on your tax bracket and other factors.',
        'Consult with a tax professional for accurate calculations.',
      ],
    };

    res.json(preview);
  } catch (error) {
    logger.error('Error generating tax preview', { error: error instanceof Error ? error : undefined });
    res.status(500).json({ error: 'Failed to generate tax preview' });
  }
});

/**
 * POST /api/tax/export
 * Export tax report in various formats
 */
router.post('/export', async (req, res) => {
  try {
    const { year, method, jurisdiction, format, fiatCurrency } = req.body;

    if (!year || !format) {
      return res.status(400).json({ error: 'Year and format are required' });
    }

    // TODO: Fetch transactions from database
    const transactions: Transaction[] = [];

    const calculator = new TaxCalculator(
      method || 'fifo',
      jurisdiction || 'US',
      fiatCurrency || 'USD'
    );
    const report = await calculator.generateReport(transactions, year);

    switch (format) {
      case 'csv':
      case 'turbotax':
      case 'taxact': {
        const csvExporter = new CSVExporter();
        const csv = csvExporter.exportReport(report, format);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="tax-report-${year}.csv"`);
        res.send(csv);
        break;
      }

      case 'pdf': {
        const pdfExporter = new PDFExporter();
        const pdf = await pdfExporter.exportReport(report);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="tax-report-${year}.pdf"`);
        res.send(pdf);
        break;
      }

      case 'form-8949': {
        if (jurisdiction !== 'US') {
          return res.status(400).json({ error: 'Form 8949 is only available for US jurisdiction' });
        }
        const form8949Exporter = new Form8949Exporter();
        const form8949Data = form8949Exporter.generateForm8949(report);
        const csv = form8949Exporter.exportAsCSV(form8949Data, 'short');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="form-8949-${year}.csv"`);
        res.send(csv);
        break;
      }

      case 'json': {
        res.json(report);
        break;
      }

      default:
        res.status(400).json({ error: 'Invalid export format' });
    }
  } catch (error) {
    logger.error('Error exporting tax report', { error: error instanceof Error ? error : undefined });
    res.status(500).json({ error: 'Failed to export tax report' });
  }
});

/**
 * GET /api/tax/transactions
 * Get tax-relevant transactions for a year
 */
router.get('/transactions', async (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const type = req.query.type as string;

    // TODO: Fetch transactions from database
    const transactions: Transaction[] = [];

    // Filter by type if specified
    const filteredTransactions = type
      ? transactions.filter(tx => tx.type === type)
      : transactions;

    res.json({
      year,
      count: filteredTransactions.length,
      transactions: filteredTransactions,
    });
  } catch (error) {
    logger.error('Error fetching tax transactions', { error: error instanceof Error ? error : undefined });
    res.status(500).json({ error: 'Failed to fetch tax transactions' });
  }
});

/**
 * GET /api/tax/methods
 * Get available cost basis methods
 */
router.get('/methods', (req, res) => {
  res.json({
    methods: [
      {
        id: 'fifo',
        name: 'First In, First Out (FIFO)',
        description: 'Sells the oldest assets first',
      },
      {
        id: 'lifo',
        name: 'Last In, First Out (LIFO)',
        description: 'Sells the newest assets first',
      },
      {
        id: 'hifo',
        name: 'Highest In, First Out (HIFO)',
        description: 'Sells the assets with the highest cost basis first',
      },
      {
        id: 'specific-id',
        name: 'Specific Identification',
        description: 'Manually select which assets to sell',
      },
    ],
  });
});

/**
 * GET /api/tax/jurisdictions
 * Get supported jurisdictions
 */
router.get('/jurisdictions', (req, res) => {
  res.json({
    jurisdictions: [
      { code: 'US', name: 'United States', currency: 'USD' },
      { code: 'UK', name: 'United Kingdom', currency: 'GBP' },
      { code: 'DE', name: 'Germany', currency: 'EUR' },
      { code: 'FR', name: 'France', currency: 'EUR' },
      { code: 'ES', name: 'Spain', currency: 'EUR' },
      { code: 'IT', name: 'Italy', currency: 'EUR' },
      { code: 'NL', name: 'Netherlands', currency: 'EUR' },
      { code: 'CA', name: 'Canada', currency: 'CAD' },
      { code: 'AU', name: 'Australia', currency: 'AUD' },
      { code: 'JP', name: 'Japan', currency: 'JPY' },
      { code: 'SG', name: 'Singapore', currency: 'SGD' },
    ],
  });
});

/**
 * GET /api/tax/disclaimer
 * Get tax disclaimer
 */
router.get('/disclaimer', (req, res) => {
  res.json({
    disclaimer: `
DISCLAIMER: This software is provided for informational purposes only and does not
constitute tax, legal, or financial advice. Tax laws are complex and subject to change.
This software may not account for all tax rules, deductions, or special circumstances
that may apply to your situation.

You should consult with a qualified tax professional or certified public accountant
regarding your specific tax situation before making any tax-related decisions or filing
tax returns. The developers and maintainers of this software are not responsible for
any tax-related decisions, consequences, penalties, or liabilities that may arise from
the use of this software.

By using this software, you acknowledge that you understand these limitations and
agree to seek professional tax advice for your specific circumstances.

IMPORTANT NOTES:
- Cryptocurrency tax laws vary significantly by jurisdiction
- This software provides calculations based on general principles
- Special rules may apply to specific types of transactions
- Wash sale rules may or may not apply to cryptocurrencies depending on jurisdiction
- Always maintain detailed records of all transactions
- Consider consulting with a tax professional who specializes in cryptocurrency taxation
    `.trim(),
  });
});

export default router;
