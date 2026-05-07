import { Transaction, TaxLot, CostBasisMethod } from './types.js';

/**
 * Cost Basis Calculation
 * Implements FIFO, LIFO, HIFO, and Specific ID methods
 */

export class CostBasisCalculator {
  private lots: Map<string, TaxLot[]> = new Map();

  constructor(private method: CostBasisMethod) {}

  /**
   * Add a new tax lot (acquisition)
   */
  addLot(transaction: Transaction): void {
    if (!['buy', 'trade', 'transfer-in', 'staking-reward', 'airdrop', 'mining', 'fork', 'gift-received'].includes(transaction.type)) {
      return;
    }

    const asset = transaction.asset;
    if (!this.lots.has(asset)) {
      this.lots.set(asset, []);
    }

    const costBasis = transaction.price * transaction.amount + (transaction.fee || 0);

    const lot: TaxLot = {
      id: `${transaction.id}-lot`,
      asset,
      amount: transaction.amount,
      costBasis,
      acquiredDate: transaction.timestamp,
      transactionId: transaction.id,
    };

    this.lots.get(asset)!.push(lot);
  }

  /**
   * Dispose of lots (sale/trade)
   * Returns the lots used and their cost basis
   */
  disposeLots(
    asset: string,
    amount: number,
    specificLotIds?: string[]
  ): { lot: TaxLot; amountUsed: number; costBasis: number }[] {
    const assetLots = this.lots.get(asset);
    if (!assetLots || assetLots.length === 0) {
      throw new Error(`No lots available for asset ${asset}`);
    }

    let remainingAmount = amount;
    const disposedLots: { lot: TaxLot; amountUsed: number; costBasis: number }[] = [];

    // Specific ID method
    if (this.method === 'specific-id' && specificLotIds) {
      for (const lotId of specificLotIds) {
        if (remainingAmount <= 0) break;

        const lotIndex = assetLots.findIndex(l => l.id === lotId);
        if (lotIndex === -1) continue;

        const lot = assetLots[lotIndex];
        const amountUsed = Math.min(lot.amount, remainingAmount);
        const costBasisUsed = (lot.costBasis / lot.amount) * amountUsed;

        disposedLots.push({ lot, amountUsed, costBasis: costBasisUsed });

        lot.amount -= amountUsed;
        if (lot.amount <= 0) {
          assetLots.splice(lotIndex, 1);
        }

        remainingAmount -= amountUsed;
      }
    } else {
      // Sort lots based on method
      const sortedLots = this.sortLots(assetLots);

      for (let i = 0; i < sortedLots.length && remainingAmount > 0; i++) {
        const lot = sortedLots[i];
        const amountUsed = Math.min(lot.amount, remainingAmount);
        const costBasisUsed = (lot.costBasis / lot.amount) * amountUsed;

        disposedLots.push({ lot, amountUsed, costBasis: costBasisUsed });

        lot.amount -= amountUsed;
        if (lot.amount <= 0) {
          const originalIndex = assetLots.findIndex(l => l.id === lot.id);
          if (originalIndex !== -1) {
            assetLots.splice(originalIndex, 1);
          }
        }

        remainingAmount -= amountUsed;
      }
    }

    if (remainingAmount > 0.00001) { // Allow for floating point errors
      throw new Error(`Insufficient lots for asset ${asset}. Needed ${amount}, had ${amount - remainingAmount}`);
    }

    return disposedLots;
  }

  /**
   * Get remaining lots for an asset
   */
  getRemainingLots(asset: string): TaxLot[] {
    return this.lots.get(asset) || [];
  }

  /**
   * Get all remaining lots
   */
  getAllRemainingLots(): Map<string, TaxLot[]> {
    return new Map(this.lots);
  }

  /**
   * Get total cost basis for an asset
   */
  getTotalCostBasis(asset: string): number {
    const lots = this.lots.get(asset) || [];
    return lots.reduce((sum, lot) => sum + lot.costBasis, 0);
  }

  /**
   * Get total amount for an asset
   */
  getTotalAmount(asset: string): number {
    const lots = this.lots.get(asset) || [];
    return lots.reduce((sum, lot) => sum + lot.amount, 0);
  }

  /**
   * Sort lots based on the cost basis method
   */
  private sortLots(lots: TaxLot[]): TaxLot[] {
    const sorted = [...lots];

    switch (this.method) {
      case 'fifo':
        // First In, First Out - oldest first
        sorted.sort((a, b) => a.acquiredDate.getTime() - b.acquiredDate.getTime());
        break;

      case 'lifo':
        // Last In, First Out - newest first
        sorted.sort((a, b) => b.acquiredDate.getTime() - a.acquiredDate.getTime());
        break;

      case 'hifo':
        // Highest In, First Out - highest cost basis per unit first
        sorted.sort((a, b) => {
          const aCostPerUnit = a.costBasis / a.amount;
          const bCostPerUnit = b.costBasis / b.amount;
          return bCostPerUnit - aCostPerUnit;
        });
        break;

      case 'specific-id':
        // No sorting needed, handled separately
        break;
    }

    return sorted;
  }

  /**
   * Reset all lots (for testing or new calculation)
   */
  reset(): void {
    this.lots.clear();
  }
}
