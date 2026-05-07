import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TradingStreamService } from "./trading-stream";
import { TradingWebSocketServer } from "../websocket";

describe("TradingStreamService", () => {
  let service: TradingStreamService;
  let mockWsServer: any;

  beforeEach(() => {
    mockWsServer = {
      broadcastToChannel: vi.fn(),
      broadcastToUser: vi.fn()
    };
    service = new TradingStreamService(mockWsServer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("broadcastTradeExecuted", () => {
    it("should broadcast trade to user's trades channel", () => {
      const trade = {
        id: "trade-1",
        userId: "user123",
        symbol: "BTC/USD",
        side: "buy",
        type: "market",
        quantity: 0.5,
        price: 50000,
        status: "filled",
        executedAt: new Date()
      };

      service.broadcastTradeExecuted(trade);

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "trades:user123",
        {
          type: "trade_executed",
          trade: expect.objectContaining({
            id: "trade-1",
            symbol: "BTC/USD",
            side: "buy"
          })
        }
      );
    });

    it("should include all trade details in broadcast", () => {
      const trade = {
        id: "trade-2",
        userId: "user456",
        symbol: "ETH/USD",
        side: "sell",
        type: "limit",
        quantity: 2.0,
        price: 3000,
        status: "filled",
        executedAt: new Date(),
        fee: 0.1,
        feeAsset: "USD"
      };

      service.broadcastTradeExecuted(trade);

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "trades:user456",
        expect.objectContaining({
          type: "trade_executed",
          trade: expect.objectContaining({
            fee: 0.1,
            feeAsset: "USD"
          })
        })
      );
    });
  });

  describe("broadcastPositionOpened", () => {
    it("should broadcast position to user's positions channel", () => {
      const position = {
        id: "pos-1",
        userId: "user123",
        symbol: "BTC/USD",
        side: "long",
        entryPrice: 50000,
        quantity: 0.5,
        leverage: 2,
        openedAt: new Date()
      };

      service.broadcastPositionOpened(position);

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "positions:user123",
        {
          type: "position_opened",
          position: expect.objectContaining({
            id: "pos-1",
            side: "long",
            entryPrice: 50000
          })
        }
      );
    });
  });

  describe("broadcastPositionUpdated", () => {
    it("should broadcast position update to user's positions channel", () => {
      const position = {
        id: "pos-1",
        userId: "user123",
        symbol: "BTC/USD",
        side: "long",
        entryPrice: 50000,
        quantity: 0.5,
        currentPrice: 51000,
        unrealizedPnl: 500,
        unrealizedPnlPercent: 1.0
      };

      service.broadcastPositionUpdated(position);

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "positions:user123",
        {
          type: "position_updated",
          position: expect.objectContaining({
            currentPrice: 51000,
            unrealizedPnl: 500
          })
        }
      );
    });
  });

  describe("broadcastPositionClosed", () => {
    it("should broadcast position closure to user's positions channel", () => {
      const position = {
        id: "pos-1",
        userId: "user123",
        symbol: "BTC/USD",
        side: "long",
        entryPrice: 50000,
        exitPrice: 52000,
        quantity: 0.5,
        realizedPnl: 1000,
        realizedPnlPercent: 4.0,
        closedAt: new Date()
      };

      service.broadcastPositionClosed(position);

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "positions:user123",
        {
          type: "position_closed",
          position: expect.objectContaining({
            exitPrice: 52000,
            realizedPnl: 1000
          })
        }
      );
    });
  });

  describe("broadcastPortfolioUpdate", () => {
    it("should broadcast portfolio update to user's portfolio channel", () => {
      const portfolio = {
        userId: "user123",
        totalValue: 100000,
        availableBalance: 50000,
        positions: [
          {
            symbol: "BTC/USD",
            value: 25000,
            unrealizedPnl: 1000
          },
          {
            symbol: "ETH/USD",
            value: 25000,
            unrealizedPnl: -500
          }
        ],
        totalUnrealizedPnl: 500,
        totalRealizedPnl: 2000
      };

      service.broadcastPortfolioUpdate(portfolio);

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "portfolio:user123",
        {
          type: "portfolio_updated",
          portfolio: expect.objectContaining({
            totalValue: 100000,
            totalUnrealizedPnl: 500
          })
        }
      );
    });

    it("should include all portfolio positions", () => {
      const portfolio = {
        userId: "user456",
        totalValue: 50000,
        availableBalance: 20000,
        positions: [
          { symbol: "BTC/USD", value: 15000, unrealizedPnl: 500 },
          { symbol: "ETH/USD", value: 10000, unrealizedPnl: 200 },
          { symbol: "SOL/USD", value: 5000, unrealizedPnl: -100 }
        ],
        totalUnrealizedPnl: 600,
        totalRealizedPnl: 1000
      };

      service.broadcastPortfolioUpdate(portfolio);

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "portfolio:user456",
        expect.objectContaining({
          portfolio: expect.objectContaining({
            positions: expect.arrayContaining([
              expect.objectContaining({ symbol: "BTC/USD" }),
              expect.objectContaining({ symbol: "ETH/USD" }),
              expect.objectContaining({ symbol: "SOL/USD" })
            ])
          })
        })
      );
    });
  });

  describe("Multiple broadcasts", () => {
    it("should handle multiple simultaneous broadcasts", () => {
      const trade = {
        id: "trade-1",
        userId: "user123",
        symbol: "BTC/USD",
        side: "buy",
        type: "market",
        quantity: 0.5,
        price: 50000,
        status: "filled",
        executedAt: new Date()
      };

      const position = {
        id: "pos-1",
        userId: "user123",
        symbol: "BTC/USD",
        side: "long",
        entryPrice: 50000,
        quantity: 0.5,
        leverage: 2,
        openedAt: new Date()
      };

      service.broadcastTradeExecuted(trade);
      service.broadcastPositionOpened(position);

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledTimes(2);
      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "trades:user123",
        expect.any(Object)
      );
      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "positions:user123",
        expect.any(Object)
      );
    });

    it("should broadcast to different users independently", () => {
      const trade1 = {
        id: "trade-1",
        userId: "user123",
        symbol: "BTC/USD",
        side: "buy",
        type: "market",
        quantity: 0.5,
        price: 50000,
        status: "filled",
        executedAt: new Date()
      };

      const trade2 = {
        id: "trade-2",
        userId: "user456",
        symbol: "ETH/USD",
        side: "sell",
        type: "limit",
        quantity: 2.0,
        price: 3000,
        status: "filled",
        executedAt: new Date()
      };

      service.broadcastTradeExecuted(trade1);
      service.broadcastTradeExecuted(trade2);

      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "trades:user123",
        expect.any(Object)
      );
      expect(mockWsServer.broadcastToChannel).toHaveBeenCalledWith(
        "trades:user456",
        expect.any(Object)
      );
    });
  });
});
