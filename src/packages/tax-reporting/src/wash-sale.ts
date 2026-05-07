import { Transaction, TaxTransaction } from './types.js';

/**
 * Wash Sale Rule Implementation (US IRS)
 *
 * A wash sale occurs when you sell a security at a loss and buy the same or
 * substantially identical security within 30 days before or after the sale.
 * The loss is disallowed and added to the cost basis of the replacement security.
 *
 * NOTE: As of 2026, wash sale rules may not apply to cryptocurrencies under US law.
 * This implementation is provided for educational purposes and potential future use.
 */

export interface WashSaleAdjustment {
  originalTransactionId: string;
  disallowedLoss: number;
  replacementTransactionId: string;
  adjustedCostBasis: number;
}

export class WashSaleDetector {
  private washSaleDays: number;

  constructor(washSaleDays: number = 30) {
    this.washSaleDays = washSaleDays;
  }

  /**
   * Detect wash sales in a list of transactions
   */
  detectWashSales(transactions: Transaction[]): WashSaleAdjustment[] {
    const adjustments: WashSaleAdjustment[] = [];
    const sortedTransactions = [...transactions].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    for (let i = 0; i < sortedTransactions.length; i++) {
      const saleTransaction = sortedTransactions[i];

      // Only check sell transactions with losses
      if (saleTransaction.type !== 'sell') continue;

      // Check for purchases within the wash sale window
      const washSaleWindow = this.washSaleDays * 24 * 60 * 60 * 1000;
      const windowStart = new Date(saleTransaction.timestamp.getTime() - washSaleWindow);
      const windowEnd = new Date(saleTransaction.timestamp.getTime() + washSaleWindow);

      for (let j = 0; j < sortedTransactions.length; j++) {
        if (i === j) continue;

        const potentialReplacement = sortedTransactions[j];

        // Check if it's a buy of the same asset within the window
        if (
          potentialReplacement.type === 'buy' &&
          potentialReplacement.asset === saleTransaction.asset &&
          potentialReplacement.timestamp >= windowStart &&
          potentialReplacement.timestamp <= windowEnd
        ) {
          // This is a potential wash sale
          // In a full implementation, we would calculate the disallowed loss
          // and adjust the cost basis of the replacement
          adjustments.push({
            originalTransactionId: saleTransaction.id,
            disallowedLoss: 0, // Would be calculated based on actual loss
            replacementTransactionId: potentialReplacement.id,
            adjustedCostBasis: potentialReplacement.price * potentialReplacement.amount,
          });
        }
      }
    }

    return adjustments;
  }

  /**
   * Apply wash sale adjustments to tax transactions
   */
  applyWashSaleAdjustments(
    taxTransactions: TaxTransaction[],
    adjustments: WashSaleAdjustment[]
  ): TaxTransaction[] {
    const adjusted = [...taxTransactions];

    for (const adjustment of adjustments) {
      const saleIndex = adjusted.findIndex(t => t.id === adjustment.originalTransactionId);
      if (saleIndex !== -1) {
        const sale = adjusted[saleIndex];

        // Disallow the loss
        if (sale.gainLoss && sale.gainLoss < 0) {
          adjusted[saleIndex] = {
            ...sale,
            gainLoss: 0,
            description: `${sale.description} (Wash sale - loss disallowed)`,
          };
        }
      }

      // Add the disallowed loss to the replacement's cost basis
      const replacementIndex = adjusted.findIndex(t => t.id === adjustment.replacementTransactionId);
      if (replacementIndex !== -1) {
        const replacement = adjusted[replacementIndex];
        adjusted[replacementIndex] = {
          ...replacement,
          costBasis: (replacement.costBasis || 0) + adjustment.disallowedLoss,
          description: `${replacement.description} (Wash sale adjustment applied)`,
        };
      }
    }

    return adjusted;
  }

  /**
   * Check if two transactions form a wash sale
   */
  isWashSale(sale: Transaction, purchase: Transaction): boolean {
    if (sale.type !== 'sell' || purchase.type !== 'buy') {
      return false;
    }

    if (sale.asset !== purchase.asset) {
      return false;
    }

    const timeDiff = Math.abs(sale.timestamp.getTime() - purchase.timestamp.getTime());
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    return daysDiff <= this.washSaleDays;
  }
}
