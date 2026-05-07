import { logger } from "@trade/shared/logger";
import type { TradingWebSocketServer } from "../websocket.js";
import type { Position, Trade, MarketTick } from "@trade/shared";
import type { TradingRepository } from "@trade/trading-core";

export interface TradingEventStreamConfig {
  wsServer: TradingWebSocketServer;
  repository: TradingRepository;
}

export interface OrderFilledEvent {
  type: "ORDER_FILLED";
  positionId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  quantity: number;
  notional: number;
  leverage: number;
  marginUsdt: number;
  timestamp: string;
}

export interface PositionOpenedEvent {
  type: "POSITION_OPENED";
  position: Position;
  timestamp: string;
}

export interface PositionClosedEvent {
  type: "POSITION_CLOSED";
  position: Position;
  trade: Trade;
  realizedPnl: number;
  realizedPnlPercent: number;
  timestamp: string;
}

export interface PositionUpdatedEvent {
  type: "POSITION_UPDATED";
  positionId: string;
  symbol: string;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  timestamp: string;
}

export interface PortfolioUpdateEvent {
  type: "PORTFOLIO_UPDATED";
  totalEquity: number;
  totalPnl: number;
  totalPnlPercent: number;
  openPositions: number;
  closedTrades: number;
  timestamp: string;
}

export type TradingEvent =
  | OrderFilledEvent
  | PositionOpenedEvent
  | PositionClosedEvent
  | PositionUpdatedEvent
  | PortfolioUpdateEvent;

/**
 * Trading Event Streaming Service
 *
 * Listens to trading events from the trading engine and broadcasts them
 * to users via WebSocket channels. Provides real-time updates for:
 * - Order fills
 * - Position opens/closes/updates
 * - Real-time PnL calculations
 * - Portfolio updates
 */
export class TradingEventStreamService {
  private wsServer: TradingWebSocketServer;
  private repository: TradingRepository;
  private marketPrices: Map<string, number> = new Map();
  private updateInterval?: NodeJS.Timeout;

  constructor(config: TradingEventStreamConfig) {
    this.wsServer = config.wsServer;
    this.repository = config.repository;
  }

  /**
   * Start the streaming service with periodic position updates
   */
  start(intervalMs: number = 5000): void {
    if (this.updateInterval) {
      logger.warn("Trading stream already started");
      return;
    }

    this.updateInterval = setInterval(() => {
      this.broadcastPositionUpdates();
    }, intervalMs);

    logger.info({ intervalMs }, "Trading event stream started");
  }

  /**
   * Stop the streaming service
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
      logger.info("Trading event stream stopped");
    }
  }

  /**
   * Update market prices from ticks (called by market data feed)
   */
  updateMarketPrice(tick: MarketTick): void {
    this.marketPrices.set(tick.symbol, tick.price);
  }

  /**
   * Broadcast order filled event when a position is opened
   */
  broadcastOrderFilled(position: Position): void {
    const event: OrderFilledEvent = {
      type: "ORDER_FILLED",
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.entryPrice,
      quantity: position.quantity,
      notional: position.notional,
      leverage: position.leverage,
      marginUsdt: position.marginUsdt,
      timestamp: new Date().toISOString()
    };

    // Broadcast to all authenticated users (in production, filter by userId)
    this.wsServer.broadcast("trades:all", event);

    logger.info({ positionId: position.id, symbol: position.symbol }, "Order filled event broadcasted");
  }

  /**
   * Broadcast position opened event
   */
  broadcastPositionOpened(position: Position): void {
    const event: PositionOpenedEvent = {
      type: "POSITION_OPENED",
      position,
      timestamp: new Date().toISOString()
    };

    // Broadcast to all authenticated users
    this.wsServer.broadcast("positions:all", event);

    // Also broadcast portfolio update
    this.broadcastPortfolioUpdate();

    logger.info({ positionId: position.id, symbol: position.symbol }, "Position opened event broadcasted");
  }

  /**
   * Broadcast position closed event
   */
  broadcastPositionClosed(position: Position, trade: Trade): void {
    const realizedPnlPercent = position.entryPrice > 0
      ? (position.pnlUsdt / (position.marginUsdt)) * 100
      : 0;

    const event: PositionClosedEvent = {
      type: "POSITION_CLOSED",
      position,
      trade,
      realizedPnl: position.pnlUsdt,
      realizedPnlPercent,
      timestamp: new Date().toISOString()
    };

    // Broadcast to all authenticated users
    this.wsServer.broadcast("positions:all", event);
    this.wsServer.broadcast("trades:all", event);

    // Also broadcast portfolio update
    this.broadcastPortfolioUpdate();

    logger.info(
      { positionId: position.id, symbol: position.symbol, pnl: position.pnlUsdt },
      "Position closed event broadcasted"
    );
  }

  /**
   * Broadcast position updates with current PnL for all open positions
   */
  private broadcastPositionUpdates(): void {
    const positions = this.getOpenPositions();

    for (const position of positions) {
      const currentPrice = this.marketPrices.get(position.symbol);
      if (!currentPrice) continue;

      const { unrealizedPnl, unrealizedPnlPercent } = this.calculateUnrealizedPnL(
        position,
        currentPrice
      );

      const event: PositionUpdatedEvent = {
        type: "POSITION_UPDATED",
        positionId: position.id,
        symbol: position.symbol,
        currentPrice,
        unrealizedPnl,
        unrealizedPnlPercent,
        timestamp: new Date().toISOString()
      };

      // Broadcast to all authenticated users
      this.wsServer.broadcast("positions:all", event);
    }

    if (positions.length > 0) {
      // Also broadcast portfolio update
      this.broadcastPortfolioUpdate();
    }
  }

  /**
   * Broadcast portfolio update with aggregated metrics
   */
  private broadcastPortfolioUpdate(): void {
    const positions = this.getOpenPositions();
    const trades = this.getClosedTrades();

    // Calculate total unrealized PnL
    let totalUnrealizedPnl = 0;
    for (const position of positions) {
      const currentPrice = this.marketPrices.get(position.symbol);
      if (currentPrice) {
        const { unrealizedPnl } = this.calculateUnrealizedPnL(position, currentPrice);
        totalUnrealizedPnl += unrealizedPnl;
      }
    }

    // Calculate total realized PnL
    const totalRealizedPnl = trades.reduce((sum, trade) => sum + trade.pnlUsdt, 0);
    const totalPnl = totalRealizedPnl + totalUnrealizedPnl;

    // Calculate total equity (assuming initial capital of 10,000 USDT)
    const initialCapital = 10000;
    const totalEquity = initialCapital + totalPnl;
    const totalPnlPercent = (totalPnl / initialCapital) * 100;

    const event: PortfolioUpdateEvent = {
      type: "PORTFOLIO_UPDATED",
      totalEquity: this.roundMoney(totalEquity),
      totalPnl: this.roundMoney(totalPnl),
      totalPnlPercent: this.roundMoney(totalPnlPercent),
      openPositions: positions.length,
      closedTrades: trades.length,
      timestamp: new Date().toISOString()
    };

    // Broadcast to all authenticated users
    this.wsServer.broadcast("portfolio:all", event);
  }

  /**
   * Calculate unrealized PnL for an open position
   */
  private calculateUnrealizedPnL(
    position: Position,
    currentPrice: number
  ): { unrealizedPnl: number; unrealizedPnlPercent: number } {
    const priceDiff = position.side === "LONG"
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;

    const unrealizedPnl = (priceDiff / position.entryPrice) * position.notional;
    const unrealizedPnlPercent = (unrealizedPnl / position.marginUsdt) * 100;

    return {
      unrealizedPnl: this.roundMoney(unrealizedPnl),
      unrealizedPnlPercent: this.roundMoney(unrealizedPnlPercent)
    };
  }

  /**
   * Get all open positions from repository
   */
  private getOpenPositions(): Position[] {
    if (!this.repository) {
      return [];
    }
    if (typeof (this.repository as any).positions === "function") {
      return (this.repository as any).positions().filter((p: Position) => p.status === "OPEN");
    }
    return [];
  }

  /**
   * Get all closed trades from repository
   */
  private getClosedTrades(): Trade[] {
    if (!this.repository) {
      return [];
    }
    if (typeof (this.repository as any).trades === "function") {
      return (this.repository as any).trades();
    }
    return [];
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
