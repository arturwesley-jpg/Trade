/**
 * Position Manager
 * Manages paper trading positions with mark-to-market PnL calculation
 */

import { createId } from "@trade/shared";
import type {
  PaperPosition,
  OpenPositionRequest,
  UpdatePositionRequest,
  ClosePositionRequest,
  TradeHistory,
  PaperTradingConfig
} from "./types.js";

export class PositionManager {
  private positions: Map<string, PaperPosition> = new Map();
  private tradeHistory: TradeHistory[] = [];
  private config: PaperTradingConfig;

  constructor(config: Partial<PaperTradingConfig> = {}) {
    this.config = {
      makerFeePct: config.makerFeePct ?? 0.075,
      takerFeePct: config.takerFeePct ?? 0.075,
      slippagePct: config.slippagePct ?? 0.05,
      monitorIntervalMs: config.monitorIntervalMs ?? 5000,
      enableAutoClose: config.enableAutoClose ?? true
    };
  }

  /**
   * Open a new position
   */
  openPosition(request: OpenPositionRequest): PaperPosition {
    const entryFee = this.calculateFee(request.entryPrice * request.quantity, this.config.takerFeePct);
    const notional = request.entryPrice * request.quantity * (request.leverage || 1);

    const position: PaperPosition = {
      id: createId("pos"),
      userId: request.userId,
      symbol: request.symbol,
      side: request.side,
      entryPrice: request.entryPrice,
      currentPrice: request.entryPrice,
      quantity: request.quantity,
      leverage: request.leverage || 1,
      marginUsdt: request.marginUsdt,
      notional,
      unrealizedPnL: 0,
      realizedPnL: 0,
      takeProfit: request.takeProfit,
      stopLoss: request.stopLoss,
      trailingStop: request.trailingStop ? {
        distance: request.trailingStop.distance,
        activated: false,
        highestPrice: request.side === 'long' ? request.entryPrice : undefined,
        lowestPrice: request.side === 'short' ? request.entryPrice : undefined
      } : undefined,
      status: 'OPEN',
      openedAt: Date.now(),
      fees: {
        entry: entryFee,
        total: entryFee
      }
    };

    this.positions.set(position.id, position);
    return position;
  }

  /**
   * Update position TP/SL
   */
  updatePosition(positionId: string, updates: UpdatePositionRequest): PaperPosition {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    if (position.status === 'CLOSED') {
      throw new Error(`Position ${positionId} is already closed`);
    }

    if (updates.takeProfit !== undefined) {
      position.takeProfit = updates.takeProfit;
    }

    if (updates.stopLoss !== undefined) {
      position.stopLoss = updates.stopLoss;
    }

    if (updates.trailingStop !== undefined) {
      position.trailingStop = {
        distance: updates.trailingStop.distance,
        activated: false,
        highestPrice: position.side === 'long' ? position.currentPrice : undefined,
        lowestPrice: position.side === 'short' ? position.currentPrice : undefined
      };
    }

    return position;
  }

  /**
   * Close a position
   */
  closePosition(positionId: string, request: ClosePositionRequest): TradeHistory {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    if (position.status === 'CLOSED') {
      throw new Error(`Position ${positionId} is already closed`);
    }

    const exitFee = this.calculateFee(request.exitPrice * position.quantity, this.config.takerFeePct);
    const pnl = this.calculatePnL(position, request.exitPrice) - exitFee;
    const pnlPercentage = (pnl / position.marginUsdt) * 100;

    position.status = 'CLOSED';
    position.closedAt = Date.now();
    position.currentPrice = request.exitPrice;
    position.realizedPnL = pnl;
    position.fees.exit = exitFee;
    position.fees.total += exitFee;

    const trade: TradeHistory = {
      id: createId("trade"),
      positionId: position.id,
      userId: position.userId,
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice: request.exitPrice,
      quantity: position.quantity,
      leverage: position.leverage,
      pnl,
      pnlPercentage,
      fees: position.fees.total,
      duration: position.closedAt - position.openedAt,
      openedAt: position.openedAt,
      closedAt: position.closedAt,
      closeReason: request.reason || 'MANUAL'
    };

    this.tradeHistory.push(trade);
    return trade;
  }

  /**
   * Update position with current market price
   */
  updateMarketPrice(positionId: string, currentPrice: number): PaperPosition {
    const position = this.positions.get(positionId);
    if (!position || position.status === 'CLOSED') {
      throw new Error(`Position ${positionId} not found or closed`);
    }

    position.currentPrice = currentPrice;
    position.unrealizedPnL = this.calculatePnL(position, currentPrice);

    // Update trailing stop tracking
    if (position.trailingStop) {
      if (position.side === 'long') {
        if (!position.trailingStop.highestPrice || currentPrice > position.trailingStop.highestPrice) {
          position.trailingStop.highestPrice = currentPrice;
          position.trailingStop.activated = true;
        }
      } else {
        if (!position.trailingStop.lowestPrice || currentPrice < position.trailingStop.lowestPrice) {
          position.trailingStop.lowestPrice = currentPrice;
          position.trailingStop.activated = true;
        }
      }
    }

    return position;
  }

  /**
   * Get position by ID
   */
  getPosition(positionId: string): PaperPosition | undefined {
    return this.positions.get(positionId);
  }

  /**
   * Get all positions for a user
   */
  getUserPositions(userId: string, status?: 'OPEN' | 'CLOSED'): PaperPosition[] {
    return Array.from(this.positions.values()).filter(
      p => p.userId === userId && (!status || p.status === status)
    );
  }

  /**
   * Get all open positions
   */
  getOpenPositions(): PaperPosition[] {
    return Array.from(this.positions.values()).filter(p => p.status === 'OPEN');
  }

  /**
   * Get trade history for a user
   */
  getUserTradeHistory(userId: string, limit?: number): TradeHistory[] {
    const trades = this.tradeHistory.filter(t => t.userId === userId);
    return limit ? trades.slice(-limit) : trades;
  }

  /**
   * Get all trade history
   */
  getAllTradeHistory(limit?: number): TradeHistory[] {
    return limit ? this.tradeHistory.slice(-limit) : this.tradeHistory;
  }

  /**
   * Calculate PnL for a position
   */
  private calculatePnL(position: PaperPosition, exitPrice: number): number {
    const priceDiff = position.side === 'long'
      ? exitPrice - position.entryPrice
      : position.entryPrice - exitPrice;

    return (priceDiff * position.quantity * position.leverage) - position.fees.entry;
  }

  /**
   * Calculate trading fee
   */
  private calculateFee(notional: number, feePct: number): number {
    return notional * (feePct / 100);
  }

  /**
   * Check if position should be closed based on TP/SL
   */
  shouldClosePosition(position: PaperPosition): { shouldClose: boolean; reason?: string; price?: number } {
    if (position.status === 'CLOSED') {
      return { shouldClose: false };
    }

    const currentPrice = position.currentPrice;

    // Check stop loss
    if (position.stopLoss) {
      if (position.side === 'long' && currentPrice <= position.stopLoss) {
        return { shouldClose: true, reason: 'STOP_LOSS', price: position.stopLoss };
      }
      if (position.side === 'short' && currentPrice >= position.stopLoss) {
        return { shouldClose: true, reason: 'STOP_LOSS', price: position.stopLoss };
      }
    }

    // Check trailing stop
    if (position.trailingStop?.activated) {
      if (position.side === 'long' && position.trailingStop.highestPrice) {
        const trailingStopPrice = position.trailingStop.highestPrice * (1 - position.trailingStop.distance / 100);
        if (currentPrice <= trailingStopPrice) {
          return { shouldClose: true, reason: 'TRAILING_STOP', price: currentPrice };
        }
      }
      if (position.side === 'short' && position.trailingStop.lowestPrice) {
        const trailingStopPrice = position.trailingStop.lowestPrice * (1 + position.trailingStop.distance / 100);
        if (currentPrice >= trailingStopPrice) {
          return { shouldClose: true, reason: 'TRAILING_STOP', price: currentPrice };
        }
      }
    }

    // Check take profit (support multiple TP levels)
    if (position.takeProfit && position.takeProfit.length > 0) {
      for (const tp of position.takeProfit) {
        if (position.side === 'long' && currentPrice >= tp) {
          return { shouldClose: true, reason: 'TAKE_PROFIT', price: tp };
        }
        if (position.side === 'short' && currentPrice <= tp) {
          return { shouldClose: true, reason: 'TAKE_PROFIT', price: tp };
        }
      }
    }

    return { shouldClose: false };
  }
}
