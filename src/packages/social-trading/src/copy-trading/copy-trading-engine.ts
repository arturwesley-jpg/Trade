/**
 * Copy Trading Engine
 * Handles automatic trade copying with risk management
 */

import { EventEmitter } from 'events';
import type {
  CopySettings,
  CopyTradeExecution,
  TraderProfile,
  RiskWarning,
  Position,
} from '../types.js';

export interface Trade {
  id: string;
  userId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  type: 'market' | 'limit';
  stopLoss?: number;
  takeProfit?: number;
  timestamp: Date;
}

export interface CopyTradeResult {
  success: boolean;
  execution?: CopyTradeExecution;
  error?: string;
  warnings?: RiskWarning[];
}

export class CopyTradingEngine extends EventEmitter {
  private activeCopyTrades: Map<string, CopySettings> = new Map();
  private traderPerformance: Map<string, { drawdown: number; consecutiveLosses: number }> = new Map();

  /**
   * Start copying a trader
   */
  async startCopyTrading(settings: CopySettings): Promise<void> {
    // Validate settings
    this.validateCopySettings(settings);

    // Check risk warnings
    const warnings = await this.checkRiskWarnings(settings.traderId);
    if (warnings.some(w => w.severity === 'critical')) {
      throw new Error('Critical risk warnings prevent copy trading: ' + warnings.map(w => w.message).join(', '));
    }

    this.activeCopyTrades.set(settings.copyTradeId, settings);

    this.emit('copy_trading_started', {
      copyTradeId: settings.copyTradeId,
      followerId: settings.followerId,
      traderId: settings.traderId,
      warnings,
    });
  }

  /**
   * Stop copying a trader
   */
  async stopCopyTrading(copyTradeId: string, reason?: string): Promise<void> {
    const settings = this.activeCopyTrades.get(copyTradeId);
    if (!settings) {
      throw new Error('Copy trade not found');
    }

    this.activeCopyTrades.delete(copyTradeId);

    this.emit('copy_trading_stopped', {
      copyTradeId,
      followerId: settings.followerId,
      traderId: settings.traderId,
      reason,
    });
  }

  /**
   * Process a trade from a trader being copied
   */
  async processTrade(trade: Trade): Promise<CopyTradeResult[]> {
    const results: CopyTradeResult[] = [];

    // Find all active copy trades for this trader
    const copyTrades = Array.from(this.activeCopyTrades.values())
      .filter(ct => ct.traderId === trade.userId && ct.enabled);

    for (const copySettings of copyTrades) {
      const result = await this.executeCopyTrade(trade, copySettings);
      results.push(result);

      // Check stop conditions after each trade
      if (result.success) {
        await this.checkStopConditions(copySettings);
      }
    }

    return results;
  }

  /**
   * Execute a copy trade for a follower
   */
  private async executeCopyTrade(
    originalTrade: Trade,
    settings: CopySettings
  ): Promise<CopyTradeResult> {
    const warnings: RiskWarning[] = [];

    // Check if symbol is allowed
    if (!this.isSymbolAllowed(originalTrade.symbol, settings)) {
      return {
        success: false,
        error: 'Symbol not allowed in copy settings',
      };
    }

    // Calculate copy quantity
    const copyQuantity = this.calculateCopyQuantity(originalTrade, settings);
    if (copyQuantity === 0) {
      return {
        success: false,
        error: 'Calculated quantity is zero or below minimum',
      };
    }

    // Check max amount per trade
    if (settings.maxAmountPerTrade) {
      const tradeAmount = copyQuantity * originalTrade.price;
      if (tradeAmount > settings.maxAmountPerTrade) {
        warnings.push({
          type: 'max_exposure',
          severity: 'warning',
          message: `Trade amount ${tradeAmount} exceeds max per trade ${settings.maxAmountPerTrade}`,
        });
        return {
          success: false,
          error: 'Trade amount exceeds maximum per trade limit',
          warnings,
        };
      }
    }

    // Check total exposure
    if (settings.maxTotalExposure) {
      const currentExposure = await this.getCurrentExposure(settings.followerId);
      const newExposure = currentExposure + (copyQuantity * originalTrade.price);
      if (newExposure > settings.maxTotalExposure) {
        warnings.push({
          type: 'max_exposure',
          severity: 'warning',
          message: `Total exposure ${newExposure} would exceed limit ${settings.maxTotalExposure}`,
        });
        return {
          success: false,
          error: 'Total exposure limit would be exceeded',
          warnings,
        };
      }
    }

    // Create copy trade execution
    const execution: CopyTradeExecution = {
      id: this.generateId(),
      copyTradeId: settings.copyTradeId,
      originalTradeId: originalTrade.id,
      followerId: settings.followerId,
      traderId: settings.traderId,
      symbol: originalTrade.symbol,
      side: originalTrade.side,
      quantity: copyQuantity,
      price: originalTrade.price,
      status: 'pending',
      createdAt: new Date(),
    };

    try {
      // Execute the trade (this would integrate with the actual trading system)
      await this.executeTradeOrder(execution, originalTrade, settings);

      execution.status = 'executed';
      execution.executedAt = new Date();

      this.emit('copy_trade_executed', execution);

      return {
        success: true,
        execution,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      execution.status = 'failed';
      execution.reason = error instanceof Error ? error.message : 'Unknown error';

      this.emit('copy_trade_failed', execution);

      return {
        success: false,
        error: execution.reason,
        warnings,
      };
    }
  }

  /**
   * Calculate the quantity to copy based on settings
   */
  private calculateCopyQuantity(trade: Trade, settings: CopySettings): number {
    const baseQuantity = trade.quantity * (settings.copyPercentage / 100);

    // Round to appropriate precision based on symbol
    // This is simplified - real implementation would use symbol info
    return Math.floor(baseQuantity * 100) / 100;
  }

  /**
   * Check if symbol is allowed in copy settings
   */
  private isSymbolAllowed(symbol: string, settings: CopySettings): boolean {
    if (settings.excludedSymbols?.includes(symbol)) {
      return false;
    }

    if (settings.allowedSymbols && settings.allowedSymbols.length > 0) {
      return settings.allowedSymbols.includes(symbol);
    }

    return true;
  }

  /**
   * Execute the actual trade order
   */
  private async executeTradeOrder(
    execution: CopyTradeExecution,
    originalTrade: Trade,
    settings: CopySettings
  ): Promise<void> {
    // This would integrate with the actual trading system
    // For now, simulate execution
    await new Promise(resolve => setTimeout(resolve, 100));

    // In real implementation:
    // 1. Place order through trading system
    // 2. Handle stop loss / take profit if settings allow
    // 3. Track execution price and slippage
    // 4. Update follower's portfolio
  }

  /**
   * Get current exposure for a follower
   */
  private async getCurrentExposure(followerId: string): Promise<number> {
    // This would query the actual portfolio/positions
    // For now, return mock value
    return 0;
  }

  /**
   * Check stop conditions and auto-stop if needed
   */
  private async checkStopConditions(settings: CopySettings): Promise<void> {
    const conditions = settings.stopCopyConditions;
    if (!conditions) return;

    const performance = this.traderPerformance.get(settings.traderId);
    if (!performance) return;

    let shouldStop = false;
    let reason = '';

    // Check max drawdown
    if (conditions.maxDrawdown && performance.drawdown >= conditions.maxDrawdown) {
      shouldStop = true;
      reason = `Max drawdown ${conditions.maxDrawdown}% exceeded (current: ${performance.drawdown}%)`;
    }

    // Check consecutive losses
    if (conditions.consecutiveLosses && performance.consecutiveLosses >= conditions.consecutiveLosses) {
      shouldStop = true;
      reason = `${conditions.consecutiveLosses} consecutive losses reached`;
    }

    if (shouldStop) {
      await this.stopCopyTrading(settings.copyTradeId, reason);
    }
  }

  /**
   * Update trader performance metrics
   */
  updateTraderPerformance(
    traderId: string,
    drawdown: number,
    consecutiveLosses: number
  ): void {
    this.traderPerformance.set(traderId, { drawdown, consecutiveLosses });
  }

  /**
   * Check risk warnings for a trader
   */
  private async checkRiskWarnings(traderId: string): Promise<RiskWarning[]> {
    const warnings: RiskWarning[] = [];

    // This would check actual trader data
    // For now, return mock warnings based on common scenarios

    const performance = this.traderPerformance.get(traderId);
    if (performance) {
      if (performance.drawdown > 20) {
        warnings.push({
          type: 'high_drawdown',
          severity: 'warning',
          message: `Trader is experiencing high drawdown (${performance.drawdown}%)`,
          details: { drawdown: performance.drawdown },
        });
      }

      if (performance.consecutiveLosses >= 5) {
        warnings.push({
          type: 'volatile_strategy',
          severity: 'warning',
          message: `Trader has ${performance.consecutiveLosses} consecutive losses`,
          details: { consecutiveLosses: performance.consecutiveLosses },
        });
      }
    }

    return warnings;
  }

  /**
   * Validate copy settings
   */
  private validateCopySettings(settings: CopySettings): void {
    if (settings.copyPercentage < 1 || settings.copyPercentage > 100) {
      throw new Error('Copy percentage must be between 1 and 100');
    }

    if (settings.maxAmountPerTrade && settings.maxAmountPerTrade <= 0) {
      throw new Error('Max amount per trade must be positive');
    }

    if (settings.maxTotalExposure && settings.maxTotalExposure <= 0) {
      throw new Error('Max total exposure must be positive');
    }

    if (settings.stopCopyConditions.maxDrawdown &&
        (settings.stopCopyConditions.maxDrawdown < 0 || settings.stopCopyConditions.maxDrawdown > 100)) {
      throw new Error('Max drawdown must be between 0 and 100');
    }
  }

  /**
   * Get active copy trades for a follower
   */
  getActiveCopyTrades(followerId: string): CopySettings[] {
    return Array.from(this.activeCopyTrades.values())
      .filter(ct => ct.followerId === followerId);
  }

  /**
   * Get copiers for a trader
   */
  getCopiers(traderId: string): CopySettings[] {
    return Array.from(this.activeCopyTrades.values())
      .filter(ct => ct.traderId === traderId && ct.enabled);
  }

  private generateId(): string {
    return `copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
