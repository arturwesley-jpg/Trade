/**
 * Tax Reporting Types
 *
 * DISCLAIMER: This software is provided for informational purposes only and does not
 * constitute tax, legal, or financial advice. Users should consult with qualified tax
 * professionals regarding their specific tax situations. The developers and maintainers
 * of this software are not responsible for any tax-related decisions or consequences.
 */

export type CostBasisMethod = 'fifo' | 'lifo' | 'hifo' | 'specific-id';

export type TransactionType =
  | 'buy'
  | 'sell'
  | 'trade'
  | 'transfer-in'
  | 'transfer-out'
  | 'staking-reward'
  | 'airdrop'
  | 'mining'
  | 'fork'
  | 'gift-received'
  | 'gift-sent';

export type Jurisdiction =
  | 'US'
  | 'UK'
  | 'DE' // Germany
  | 'FR' // France
  | 'ES' // Spain
  | 'IT' // Italy
  | 'NL' // Netherlands
  | 'CA' // Canada
  | 'AU' // Australia
  | 'JP' // Japan
  | 'SG'; // Singapore

export interface Transaction {
  id: string;
  timestamp: Date;
  type: TransactionType;
  asset: string;
  amount: number;
  price: number; // Price per unit in fiat
  fiatCurrency: string;
  fee?: number;
  feeCurrency?: string;
  exchange?: string;
  notes?: string;
}

export interface TaxTransaction {
  id: string;
  date: Date;
  type: TransactionType;
  asset: string;
  amount: number;
  proceeds?: number; // For sales
  costBasis?: number; // For sales
  gainLoss?: number;
  isShortTerm: boolean;
  acquiredDate?: Date;
  disposedDate?: Date;
  description: string;
}

export interface TaxLot {
  id: string;
  asset: string;
  amount: number;
  costBasis: number;
  acquiredDate: Date;
  transactionId: string;
}

export interface TaxSummary {
  totalGains: number;
  totalLosses: number;
  netGainLoss: number;
  shortTermGains: number;
  shortTermLosses: number;
  longTermGains: number;
  longTermLosses: number;
  ordinaryIncome: number; // Staking, mining, airdrops
  totalFees: number;
}

export interface TaxReport {
  year: number;
  jurisdiction: Jurisdiction;
  method: CostBasisMethod;
  fiatCurrency: string;
  summary: TaxSummary;
  transactions: TaxTransaction[];
  incomeTransactions: TaxTransaction[];
  unrealizedGains: {
    asset: string;
    amount: number;
    costBasis: number;
    currentValue: number;
    unrealizedGain: number;
  }[];
  generatedAt: Date;
  disclaimer: string;
}

export interface JurisdictionRules {
  jurisdiction: Jurisdiction;
  shortTermThresholdDays: number; // Days to qualify as long-term
  washSaleRuleDays?: number; // US: 30 days
  allowsSpecificId: boolean;
  taxYearStart: { month: number; day: number }; // e.g., US: Jan 1, UK: April 6
  requiresCapitalGainsReport: boolean;
  requiresIncomeReport: boolean;
}

export interface ExportFormat {
  format: 'csv' | 'pdf' | 'json' | 'form-8949' | 'turbotax' | 'taxact';
  includeUnrealized?: boolean;
  includeIncome?: boolean;
}

export interface TaxPreview {
  estimatedTaxLiability: number;
  shortTermGains: number;
  longTermGains: number;
  ordinaryIncome: number;
  totalFees: number;
  effectiveTaxRate?: number;
  notes: string[];
}
