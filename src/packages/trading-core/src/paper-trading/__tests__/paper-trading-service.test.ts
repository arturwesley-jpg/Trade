/**
 * Paper Trading System Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PaperTradingService } from "./paper-trading-service.js";
import type { PositionCloseEvent } from "./types.js";

describe("PaperTradingService", () => {
  let service: PaperTradingService;

  beforeEach(() => {
    service = new PaperTradingService(
      {
        makerFeePct: 0.075,
        takerFeePct: 0.075,
        slippagePct: 0.05,
        monitorIntervalMs: 100,
        enableAutoClose: true
      },
      10000
    );
  });

  afterEach(() => {
    service.stop();
  });

  describe("Position Management", () => {
    it("should open a long position", () => {
      const position = service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "long",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 10,
        marginUsdt: 1000,
        takeProfit: [105000],
        stopLoss: 98000
      });

      expect(position.id).toBeDefined();
      expect(position.side).toBe("long");
      expect(position.status).toBe("OPEN");
      expect(position.unrealizedPnL).toBe(0);
    });

    it("should open a short position", () => {
      const position = service.openPosition({
        userId: "user1",
        symbol: "ETH-USDT",
        side: "short",
        entryPrice: 3000,
        quantity: 1,
        leverage: 5,
        marginUsdt: 600,
        stopLoss: 3100
      });

      expect(position.side).toBe("short");
      expect(position.status).toBe("OPEN");
    });

    it("should update position TP/SL", () => {
      const position = service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "long",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 10,
        marginUsdt: 1000
      });

      const updated = service.updatePosition(position.id, {
        takeProfit: [105000, 110000],
        stopLoss: 98000
      });

      expect(updated.takeProfit).toEqual([105000, 110000]);
      expect(updated.stopLoss).toBe(98000);
    });

    it("should close position manually", () => {
      const position = service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "long",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 10,
        marginUsdt: 1000
      });

      const trade = service.closePosition(position.id, {
        exitPrice: 105000,
        reason: "MANUAL"
      });

      expect(trade.closeReason).toBe("MANUAL");
      expect(trade.pnl).toBeGreaterThan(0);
    });

    it("should calculate fees correctly", () => {
      const position = service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "long",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 1,
        marginUsdt: 10000
      });

      const trade = service.closePosition(position.id, {
        exitPrice: 100000,
        reason: "MANUAL"
      });

      // Entry fee: 100000 * 0.1 * 0.075% = 7.5
      // Exit fee: 100000 * 0.1 * 0.075% = 7.5
      // Total fees: 15
      expect(trade.fees).toBe(15);
      expect(trade.pnl).toBe(-15); // No price change, only fees
    });
  });

  describe("PnL Calculation", () => {
    it("should calculate long position profit", () => {
      const position = service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "long",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 10,
        marginUsdt: 1000
      });

      const trade = service.closePosition(position.id, {
        exitPrice: 105000,
        reason: "MANUAL"
      });

      // Price diff: 5000
      // PnL: 5000 * 0.1 * 10 = 5000
      // Minus fees
      expect(trade.pnl).toBeGreaterThan(4900);
      expect(trade.pnl).toBeLessThan(5000);
    });

    it("should calculate short position profit", () => {
      const position = service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "short",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 10,
        marginUsdt: 1000
      });

      const trade = service.closePosition(position.id, {
        exitPrice: 95000,
        reason: "MANUAL"
      });

      // Price diff: 5000 (in favor of short)
      // PnL: 5000 * 0.1 * 10 = 5000
      // Minus fees
      expect(trade.pnl).toBeGreaterThan(4900);
      expect(trade.pnl).toBeLessThan(5000);
    });

    it("should calculate long position loss", () => {
      const position = service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "long",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 10,
        marginUsdt: 1000
      });

      const trade = service.closePosition(position.id, {
        exitPrice: 98000,
        reason: "MANUAL"
      });

      // Price diff: -2000
      // PnL: -2000 * 0.1 * 10 = -2000
      // Minus fees
      expect(trade.pnl).toBeLessThan(-2000);
    });
  });

  describe("Automated TP/SL", () => {
    it("should trigger take profit for long position", async () => {
      const closeEvents: PositionCloseEvent[] = [];
      service.onPositionClose((event) => closeEvents.push(event));

      const position = service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "long",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 10,
        marginUsdt: 1000,
        takeProfit: [105000]
      });

      service.start();
      service.updateMarketPrice("BTC-USDT", 105000);

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(closeEvents.length).toBe(1);
      expect(closeEvents[0].reason).toBe("TAKE_PROFIT");
      expect(closeEvents[0].pnl).toBeGreaterThan(0);
    });

    it("should trigger stop loss for long position", async () => {
      const closeEvents: PositionCloseEvent[] = [];
      service.onPositionClose((event) => closeEvents.push(event));

      const position = service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "long",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 10,
        marginUsdt: 1000,
        stopLoss: 98000
      });

      service.start();
      service.updateMarketPrice("BTC-USDT", 98000);

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(closeEvents.length).toBe(1);
      expect(closeEvents[0].reason).toBe("STOP_LOSS");
      expect(closeEvents[0].pnl).toBeLessThan(0);
    });

    it("should trigger trailing stop for long position", async () => {
      const closeEvents: PositionCloseEvent[] = [];
      service.onPositionClose((event) => closeEvents.push(event));

      const position = service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "long",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 10,
        marginUsdt: 1000,
        trailingStop: {
          distance: 2 // 2%
        }
      });

      service.start();

      // Price goes up
      service.updateMarketPrice("BTC-USDT", 105000);
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Price drops by 2% from high
      service.updateMarketPrice("BTC-USDT", 102900);
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(closeEvents.length).toBe(1);
      expect(closeEvents[0].reason).toBe("TRAILING_STOP");
    });
  });

  describe("Performance Analytics", () => {
    it("should calculate win rate", () => {
      // Open and close 3 winning trades
      for (let i = 0; i < 3; i++) {
        const pos = service.openPosition({
          userId: "user1",
          symbol: "BTC-USDT",
          side: "long",
          entryPrice: 100000,
          quantity: 0.1,
          leverage: 1,
          marginUsdt: 10000
        });
        service.closePosition(pos.id, { exitPrice: 101000, reason: "MANUAL" });
      }

      // Open and close 2 losing trades
      for (let i = 0; i < 2; i++) {
        const pos = service.openPosition({
          userId: "user1",
          symbol: "BTC-USDT",
          side: "long",
          entryPrice: 100000,
          quantity: 0.1,
          leverage: 1,
          marginUsdt: 10000
        });
        service.closePosition(pos.id, { exitPrice: 99000, reason: "MANUAL" });
      }

      const performance = service.getUserPerformance("user1");

      expect(performance.totalTrades).toBe(5);
      expect(performance.winningTrades).toBe(3);
      expect(performance.losingTrades).toBe(2);
      expect(performance.winRate).toBe(60);
    });

    it("should calculate profit factor", () => {
      // Winning trade: +100
      const pos1 = service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "long",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 1,
        marginUsdt: 10000
      });
      service.closePosition(pos1.id, { exitPrice: 101000, reason: "MANUAL" });

      // Losing trade: -50
      const pos2 = service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "long",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 1,
        marginUsdt: 10000
      });
      service.closePosition(pos2.id, { exitPrice: 99500, reason: "MANUAL" });

      const performance = service.getUserPerformance("user1");

      // Profit factor should be around 2 (100 / 50)
      expect(performance.profitFactor).toBeGreaterThan(1.5);
      expect(performance.profitFactor).toBeLessThan(2.5);
    });
  });

  describe("Position Queries", () => {
    it("should get user positions", () => {
      service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "long",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 10,
        marginUsdt: 1000
      });

      service.openPosition({
        userId: "user2",
        symbol: "ETH-USDT",
        side: "short",
        entryPrice: 3000,
        quantity: 1,
        leverage: 5,
        marginUsdt: 600
      });

      const user1Positions = service.getUserPositions("user1");
      const user2Positions = service.getUserPositions("user2");

      expect(user1Positions.length).toBe(1);
      expect(user2Positions.length).toBe(1);
    });

    it("should filter positions by status", () => {
      const pos = service.openPosition({
        userId: "user1",
        symbol: "BTC-USDT",
        side: "long",
        entryPrice: 100000,
        quantity: 0.1,
        leverage: 10,
        marginUsdt: 1000
      });

      service.closePosition(pos.id, { exitPrice: 105000, reason: "MANUAL" });

      service.openPosition({
        userId: "user1",
        symbol: "ETH-USDT",
        side: "long",
        entryPrice: 3000,
        quantity: 1,
        leverage: 5,
        marginUsdt: 600
      });

      const openPositions = service.getUserPositions("user1", "OPEN");
      const closedPositions = service.getUserPositions("user1", "CLOSED");

      expect(openPositions.length).toBe(1);
      expect(closedPositions.length).toBe(1);
    });
  });
});
