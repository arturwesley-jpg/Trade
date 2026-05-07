/**
 * Unit tests for formatters
 */

import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatPnL,
  formatPercentage,
  formatPosition,
  formatTrade,
  formatDate,
  calculateDuration,
  escapeMarkdown
} from "../utils/formatters.js";
import type { Position, Trade } from "@trade/shared";

describe("formatPrice", () => {
  it("should format prices with 2 decimals", () => {
    expect(formatPrice(100000)).toBe("$100,000.00");
    expect(formatPrice(3000.5)).toBe("$3,000.50");
    expect(formatPrice(0.01)).toBe("$0.01");
  });
});

describe("formatPnL", () => {
  it("should format positive PnL with green emoji", () => {
    expect(formatPnL(100.5)).toBe("🟢 +100.50 USDT");
  });

  it("should format negative PnL with red emoji", () => {
    expect(formatPnL(-50.25)).toBe("🔴 -50.25 USDT");
  });

  it("should format zero PnL", () => {
    expect(formatPnL(0)).toBe("🟢 +0.00 USDT");
  });
});

describe("formatPercentage", () => {
  it("should format positive percentages", () => {
    expect(formatPercentage(5.5)).toBe("+5.50%");
  });

  it("should format negative percentages", () => {
    expect(formatPercentage(-2.3)).toBe("-2.30%");
  });
});

describe("formatPosition", () => {
  it("should format LONG position", () => {
    const position: Position = {
      id: "pos-1",
      orderIntentId: "intent-1",
      symbol: "BTC-USDT",
      side: "LONG",
      status: "OPEN",
      entryPrice: 100000,
      leverage: 10,
      marginUsdt: 1000,
      notional: 10000,
      quantity: 0.1,
      pnlUsdt: 50,
      openedAt: "2026-05-03T17:00:00.000Z",
      mode: "paper"
    };

    const result = formatPosition(position);

    expect(result).toContain("📈");
    expect(result).toContain("BTC-USDT");
    expect(result).toContain("LONG");
    expect(result).toContain("$100,000.00");
    expect(result).toContain("10x");
    expect(result).toContain("1000.00 USDT");
  });

  it("should format SHORT position", () => {
    const position: Position = {
      id: "pos-2",
      orderIntentId: "intent-2",
      symbol: "ETH-USDT",
      side: "SHORT",
      status: "OPEN",
      entryPrice: 3000,
      leverage: 5,
      marginUsdt: 500,
      notional: 2500,
      quantity: 0.8333,
      pnlUsdt: -25,
      openedAt: "2026-05-03T16:00:00.000Z",
      mode: "paper"
    };

    const result = formatPosition(position);

    expect(result).toContain("📉");
    expect(result).toContain("ETH-USDT");
    expect(result).toContain("SHORT");
  });
});

describe("formatTrade", () => {
  it("should format completed trade", () => {
    const trade: Trade = {
      id: "trade-1",
      positionId: "pos-1",
      symbol: "BTC-USDT",
      side: "LONG",
      entryPrice: 100000,
      exitPrice: 101000,
      pnlUsdt: 100,
      openedAt: "2026-05-03T16:00:00.000Z",
      closedAt: "2026-05-03T17:00:00.000Z",
      mode: "paper",
      marginUsdt: 1000,
      status: "CLOSED"
    };

    const result = formatTrade(trade);

    expect(result).toContain("📈");
    expect(result).toContain("BTC-USDT");
    expect(result).toContain("$100,000.00");
    expect(result).toContain("$101,000.00");
    expect(result).toContain("🟢 +100.00 USDT");
  });
});

describe("calculateDuration", () => {
  it("should calculate duration in minutes", () => {
    const start = "2026-05-03T17:00:00.000Z";
    const end = "2026-05-03T17:30:00.000Z";
    expect(calculateDuration(start, end)).toBe("30m");
  });

  it("should calculate duration in hours and minutes", () => {
    const start = "2026-05-03T15:00:00.000Z";
    const end = "2026-05-03T17:30:00.000Z";
    expect(calculateDuration(start, end)).toBe("2h 30m");
  });

  it("should calculate duration in days and hours", () => {
    const start = "2026-05-01T17:00:00.000Z";
    const end = "2026-05-03T19:00:00.000Z";
    expect(calculateDuration(start, end)).toBe("2d 2h");
  });
});

describe("escapeMarkdown", () => {
  it("should escape markdown special characters", () => {
    expect(escapeMarkdown("*bold*")).toBe("\\*bold\\*");
    expect(escapeMarkdown("_italic_")).toBe("\\_italic\\_");
    expect(escapeMarkdown("[link](url)")).toBe("\\[link\\]\\(url\\)");
  });
});
