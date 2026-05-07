# Tax Reporting Package

Comprehensive tax reporting system for cryptocurrency trading.

## Disclaimer

**IMPORTANT**: This software is provided for informational purposes only and does not constitute tax, legal, or financial advice. Tax laws are complex and subject to change. This software may not account for all tax rules, deductions, or special circumstances that may apply to your situation.

You should consult with a qualified tax professional or certified public accountant regarding your specific tax situation before making any tax-related decisions or filing tax returns. The developers and maintainers of this software are not responsible for any tax-related decisions, consequences, penalties, or liabilities that may arise from the use of this software.

## Features

- **Multiple Cost Basis Methods**: FIFO, LIFO, HIFO, Specific ID
- **Multi-Jurisdiction Support**: US, UK, Germany, France, Spain, Italy, Netherlands, Canada, Australia, Japan, Singapore
- **Capital Gains Calculation**: Short-term and long-term gains/losses
- **Income Tracking**: Staking rewards, airdrops, mining, forks
- **Wash Sale Detection**: US wash sale rule implementation
- **Export Formats**: CSV, PDF, IRS Form 8949, TurboTax, TaxAct
- **Unrealized Gains**: Track unrealized gains on remaining holdings

## Usage

### Basic Tax Report Generation

```typescript
import { TaxCalculator, Transaction } from '@trade/tax-reporting';

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

console.log('Net Gain/Loss:', report.summary.netGainLoss);
console.log('Short-term Gains:', report.summary.shortTermGains);
console.log('Long-term Gains:', report.summary.longTermGains);
```

### Export to CSV

```typescript
import { CSVExporter } from '@trade/tax-reporting';

const exporter = new CSVExporter();

// Standard format
const csv = exporter.exportReport(report, 'standard');

// TurboTax format
const turboTaxCsv = exporter.exportReport(report, 'turbotax');

// TaxAct format
const taxActCsv = exporter.exportReport(report, 'taxact');
```

### Export to PDF

```typescript
import { PDFExporter } from '@trade/tax-reporting';

const pdfExporter = new PDFExporter();
const pdfBuffer = await pdfExporter.exportReport(report);

// Save to file
fs.writeFileSync('tax-report-2024.pdf', pdfBuffer);
```

### IRS Form 8949

```typescript
import { Form8949Exporter } from '@trade/tax-reporting';

const form8949Exporter = new Form8949Exporter();
const form8949Data = form8949Exporter.generateForm8949(report);

// Export short-term transactions
const shortTermCsv = form8949Exporter.exportAsCSV(form8949Data, 'short');

// Export long-term transactions
const longTermCsv = form8949Exporter.exportAsCSV(form8949Data, 'long');
```

## Cost Basis Methods

### FIFO (First In, First Out)
Sells the oldest assets first. Most common method.

### LIFO (Last In, First Out)
Sells the newest assets first.

### HIFO (Highest In, First Out)
Sells the assets with the highest cost basis first. Can minimize gains.

### Specific ID
Manually select which specific lots to sell. Requires detailed record-keeping.

## Supported Jurisdictions

- **US**: IRS rules, 365-day holding period for long-term, wash sale rules
- **UK**: HMRC rules, tax year starts April 6
- **Germany**: 365-day holding period
- **France**: Flat tax on crypto gains
- **Spain**: Progressive tax rates
- **Italy**: 26% flat tax
- **Netherlands**: Box 3 wealth tax
- **Canada**: 50% capital gains inclusion rate
- **Australia**: CGT discount after 12 months, tax year starts July 1
- **Japan**: Miscellaneous income taxation
- **Singapore**: No capital gains tax

## Transaction Types

### Acquisitions
- `buy`: Purchase with fiat
- `trade`: Trade from another crypto
- `transfer-in`: Transfer from another wallet
- `staking-reward`: Staking rewards (taxable income)
- `airdrop`: Airdrop tokens (taxable income)
- `mining`: Mining rewards (taxable income)
- `fork`: Fork tokens (taxable income)
- `gift-received`: Received as gift

### Disposals
- `sell`: Sell for fiat
- `trade`: Trade to another crypto
- `transfer-out`: Transfer to another wallet
- `gift-sent`: Given as gift

## API Endpoints

See `apps/api/src/routes/tax.ts` for API implementation.

- `GET /api/tax/report/:year` - Generate tax report
- `GET /api/tax/preview` - Preview current year tax liability
- `POST /api/tax/export` - Export in various formats
- `GET /api/tax/transactions` - Get tax-relevant transactions
- `GET /api/tax/methods` - Get available cost basis methods
- `GET /api/tax/jurisdictions` - Get supported jurisdictions
- `GET /api/tax/disclaimer` - Get tax disclaimer

## Testing

```bash
npm test
```

## Important Notes

1. **Not Tax Advice**: This software does not provide tax advice
2. **Consult Professionals**: Always consult with a qualified tax professional
3. **Jurisdiction Specific**: Tax rules vary significantly by jurisdiction
4. **Record Keeping**: Maintain detailed records of all transactions
5. **Wash Sales**: US wash sale rules may not apply to cryptocurrencies
6. **Updates**: Tax laws change frequently, keep software updated

## License

See main project LICENSE file.
