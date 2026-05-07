/**
 * Position Monitor
 * Background worker that monitors positions and executes TP/SL automatically
 */

import type { PaperPosition, PositionCloseEvent, PaperTradingConfig } from "./types.js";
import type { PositionManager } from "./position-manager.js";

export class PositionMonitorWorker {
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;
  private priceCache: Map<string, number> = new Map();
  private closeEventHandlers: Array<(event: PositionCloseEvent) => void> = [];

  constructor(
    private positionManager: PositionManager,
    private config: PaperTradingConfig
  ) {}

  /**
   * Start monitoring positions
   */
  start(): void {
    if (this.isRunning) {
      console.warn("Position monitor is already running");
      return;
    }

    if (!this.config.enableAutoClose) {
      console.log("Auto-close is disabled, position monitor will not start");
      return;
    }

    this.isRunning = true;
    console.log(`Position monitor started (interval: ${this.config.monitorIntervalMs}ms)`);

    this.intervalId = setInterval(() => {
      this.checkAllPositions();
    }, this.config.monitorIntervalMs);
  }

  /**
   * Stop monitoring positions
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log("Position monitor stopped");
  }

  /**
   * Update price for a symbol
   */
  updatePrice(symbol: string, price: number): void {
    this.priceCache.set(symbol, price);
  }

  /**
   * Update multiple prices
   */
  updatePrices(prices: Map<string, number>): void {
    for (const [symbol, price] of prices) {
      this.priceCache.set(symbol, price);
    }
  }

  /**
   * Register a handler for position close events
   */
  onPositionClose(handler: (event: PositionCloseEvent) => void): void {
    this.closeEventHandlers.push(handler);
  }

  /**
   * Check all open positions
   */
  private checkAllPositions(): void {
    const openPositions = this.positionManager.getOpenPositions();

    for (const position of openPositions) {
      const currentPrice = this.priceCache.get(position.symbol);

      if (!currentPrice) {
        continue; // Skip if no price data available
      }

      // Update position with current price
      this.positionManager.updateMarketPrice(position.id, currentPrice);

      // Check if position should be closed
      const closeCheck = this.positionManager.shouldClosePosition(position);

      if (closeCheck.shouldClose && closeCheck.reason && closeCheck.price) {
        this.autoClosePosition(position, closeCheck.price, closeCheck.reason);
      }
    }
  }

  /**
   * Automatically close a position
   */
  private autoClosePosition(
    position: PaperPosition,
    exitPrice: number,
    reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP'
  ): void {
    try {
      const trade = this.positionManager.closePosition(position.id, {
        exitPrice,
        reason: reason as 'MANUAL' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP'
      });

      const event: PositionCloseEvent = {
        positionId: position.id,
        userId: position.userId,
        symbol: position.symbol,
        exitPrice,
        pnl: trade.pnl,
        reason,
        timestamp: Date.now()
      };

      console.log(`Auto-closed position ${position.id}: ${reason} at ${exitPrice}, PnL: ${trade.pnl.toFixed(2)}`);

      // Notify all handlers
      for (const handler of this.closeEventHandlers) {
        try {
          handler(event);
        } catch (error) {
          console.error("Error in position close handler:", error);
        }
      }
    } catch (error) {
      console.error(`Failed to auto-close position ${position.id}:`, error);
    }
  }

  /**
   * Get monitor status
   */
  getStatus(): { isRunning: boolean; openPositions: number; trackedSymbols: number } {
    return {
      isRunning: this.isRunning,
      openPositions: this.positionManager.getOpenPositions().length,
      trackedSymbols: this.priceCache.size
    };
  }
}
