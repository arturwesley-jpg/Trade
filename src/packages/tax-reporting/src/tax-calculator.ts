import { CostBasisCalculator } from './cost-basis.js';
import { WashSaleDetector } from './wash-sale.js';
import { getJurisdictionRules, isLongTerm } from './jurisdiction-rules.js';
import {
  Transaction,
  TaxTransaction,
  TaxReport,
  TaxSummary,
  CostBasisMethod,
  Jurisdiction,
} from './types.js';

/**
 * Tax Calculator
 * Main class for calculating tax reports
 */

export class TaxCalculator {
  private costBasisCalculator: CostBasisCalculator;
  private washSaleDetector?: WashSaleDetector;

  constructor(
    private method: CostBasisMethod,
    private jurisdiction: Jurisdiction,
    private fiatCurrency: string = 'USD'
  ) {
    this.costBasisCalculator = new CostBasisCalculator(method);

    const rules = getJurisdictionRules(jurisdiction);
    if (rules.washSaleRuleDays) {
      this.washSaleDetector = new WashSaleDetector(rules.washSaleRuleDays);
    }
  }

  /**
   * Generate a complete tax report for a given year
   */
  async generateReport(
    transactions: Transaction[],
    year: number,
    currentPrices?: Map<string, number>
  ): Promise<TaxReport> {
    // Filter transactions for the tax year
    const yearTransactions = this.filterTransactionsByYear(transactions, year);

    // Process all transactions to build cost basis
    const taxTransactions: TaxTransaction[] = [];
    const incomeTransactions: TaxTransaction[] = [];

    for (const transaction of yearTransactions) {
      if (this.isAcquisition(transaction)) {
        this.costBasisCalculator.addLot(transaction);

        // Income transactions (staking, mining, airdrops)
        if (this.isIncome(transaction)) {
          incomeTransactions.push(this.createIncomeTaxTransaction(transaction));
        }
      } else if (this.isDisposal(transaction)) {
        const disposalTaxTransactions = this.processDisposal(transaction);
        taxTransactions.push(...disposalTaxTransactions);
      }
    }

    // Apply wash sale rules if applicable
    let finalTaxTransactions = taxTransactions;
    if (this.washSaleDetector) {
      const washSaleAdjustments = this.washSaleDetector.detectWashSales(yearTransactions);
      finalTaxTransactions = this.washSaleDetector.applyWashSaleAdjustments(
        taxTransactions,
        washSaleAdjustments
      );
    }

    // Calculate summary
    const summary = this.calculateSummary(finalTaxTransactions, incomeTransactions);

    // Calculate unrealized gains
    const unrealizedGains = this.calculateUnrealizedGains(currentPrices);

    return {
      year,
      jurisdiction: this.jurisdiction,
      method: this.method,
      fiatCurrency: this.fiatCurrency,
      summary,
      transactions: finalTaxTransactions,
      incomeTransactions,
      unrealizedGains,
      generatedAt: new Date(),
      disclaimer: this.getDisclaimer(),
    };
  }

  /**
   * Process a disposal transaction (sell, trade-out, gift-sent)
   */
  private processDisposal(transaction: Transaction): TaxTransaction[] {
    const taxTransactions: TaxTransaction[] = [];

    try {
      const disposedLots = this.costBasisCalculator.disposeLots(
        transaction.asset,
        transaction.amount
      );

      for (const { lot, amountUsed, costBasis } of disposedLots) {
        const proceeds = transaction.price * amountUsed - (transaction.fee || 0);
        const gainLoss = proceeds - costBasis;
        const isShortTerm = !isLongTerm(lot.acquiredDate, transaction.timestamp, this.jurisdiction);

        taxTransactions.push({
          id: `${transaction.id}-${lot.id}`,
          date: transaction.timestamp,
          type: transaction.type,
          asset: transaction.asset,
          amount: amountUsed,
          proceeds,
          costBasis,
          gainLoss,
          isShortTerm,
          acquiredDate: lot.acquiredDate,
          disposedDate: transaction.timestamp,
          description: `${transaction.type} ${amountUsed} ${transaction.asset} at ${transaction.price} ${this.fiatCurrency}`,
        });
      }
    } catch (error) {
      // If we can't find lots, create a transaction with unknown cost basis
      taxTransactions.push({
        id: transaction.id,
        date: transaction.timestamp,
        type: transaction.type,
        asset: transaction.asset,
        amount: transaction.amount,
        proceeds: transaction.price * transaction.amount - (transaction.fee || 0),
        costBasis: 0,
        gainLoss: 0,
        isShortTerm: true,
        disposedDate: transaction.timestamp,
        description: `${transaction.type} ${transaction.amount} ${transaction.asset} - MISSING COST BASIS`,
      });
    }

    return taxTransactions;
  }

  /**
   * Create an income tax transaction
   */
  private createIncomeTaxTransaction(transaction: Transaction): TaxTransaction {
    const income = transaction.price * transaction.amount;

    return {
      id: transaction.id,
      date: transaction.timestamp,
      type: transaction.type,
      asset: transaction.asset,
      amount: transaction.amount,
      proceeds: income,
      costBasis: income, // Income is also the cost basis for future sales
      gainLoss: 0,
      isShortTerm: true,
      acquiredDate: transaction.timestamp,
      description: `${transaction.type} ${transaction.amount} ${transaction.asset} at ${transaction.price} ${this.fiatCurrency}`,
    };
  }

  /**
   * Calculate tax summary
   */
  private calculateSummary(
    taxTransactions: TaxTransaction[],
    incomeTransactions: TaxTransaction[]
  ): TaxSummary {
    let shortTermGains = 0;
    let shortTermLosses = 0;
    let longTermGains = 0;
    let longTermLosses = 0;

    for (const tx of taxTransactions) {
      if (!tx.gainLoss) continue;

      if (tx.isShortTerm) {
        if (tx.gainLoss > 0) {
          shortTermGains += tx.gainLoss;
        } else {
          shortTermLosses += Math.abs(tx.gainLoss);
        }
      } else {
        if (tx.gainLoss > 0) {
          longTermGains += tx.gainLoss;
        } else {
          longTermLosses += Math.abs(tx.gainLoss);
        }
      }
    }

    const ordinaryIncome = incomeTransactions.reduce((sum, tx) => sum + (tx.proceeds || 0), 0);

    const totalGains = shortTermGains + longTermGains;
    const totalLosses = shortTermLosses + longTermLosses;
    const netGainLoss = totalGains - totalLosses;

    return {
      totalGains,
      totalLosses,
      netGainLoss,
      shortTermGains,
      shortTermLosses,
      longTermGains,
      longTermLosses,
      ordinaryIncome,
      totalFees: 0, // Would be calculated from all transactions
    };
  }

  /**
   * Calculate unrealized gains for remaining lots
   */
  private calculateUnrealizedGains(currentPrices?: Map<string, number>) {
    if (!currentPrices) return [];

    const unrealizedGains: {
      asset: string;
      amount: number;
      costBasis: number;
      currentValue: number;
      unrealizedGain: number;
    }[] = [];

    const remainingLots = this.costBasisCalculator.getAllRemainingLots();

    for (const [asset, lots] of remainingLots) {
      const currentPrice = currentPrices.get(asset);
      if (!currentPrice) continue;

      const totalAmount = lots.reduce((sum, lot) => sum + lot.amount, 0);
      const totalCostBasis = lots.reduce((sum, lot) => sum + lot.costBasis, 0);
      const currentValue = totalAmount * currentPrice;
      const unrealizedGain = currentValue - totalCostBasis;

      unrealizedGains.push({
        asset,
        amount: totalAmount,
        costBasis: totalCostBasis,
        currentValue,
        unrealizedGain,
      });
    }

    return unrealizedGains;
  }

  /**
   * Filter transactions by tax year
   */
  private filterTransactionsByYear(transactions: Transaction[], year: number): Transaction[] {
    const rules = getJurisdictionRules(this.jurisdiction);
    const yearStart = new Date(year, rules.taxYearStart.month - 1, rules.taxYearStart.day);
    const yearEnd = new Date(year + 1, rules.taxYearStart.month - 1, rules.taxYearStart.day);

    return transactions.filter(
      tx => tx.timestamp >= yearStart && tx.timestamp < yearEnd
    );
  }

  /**
   * Check if transaction is an acquisition
   */
  private isAcquisition(transaction: Transaction): boolean {
    return ['buy', 'trade', 'transfer-in', 'staking-reward', 'airdrop', 'mining', 'fork', 'gift-received'].includes(
      transaction.type
    );
  }

  /**
   * Check if transaction is a disposal
   */
  private isDisposal(transaction: Transaction): boolean {
    return ['sell', 'trade', 'transfer-out', 'gift-sent'].includes(transaction.type);
  }

  /**
   * Check if transaction is income
   */
  private isIncome(transaction: Transaction): boolean {
    return ['staking-reward', 'airdrop', 'mining', 'fork'].includes(transaction.type);
  }

  /**
   * Get tax disclaimer
   */
  private getDisclaimer(): string {
    return `
DISCLAIMER: This tax report is provided for informational purposes only and does not
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
    `.trim();
  }
}
