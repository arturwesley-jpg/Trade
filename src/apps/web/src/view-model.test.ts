import { describe, expect, it } from "vitest";
import type { MarketTick, TradingSignal } from "./shared-types.js";
import {
  buildPaperOrderPayload,
  describeWhaleEvent,
  filterCommandItems,
  formatAlertStatus,
  formatSignalDirection,
  formatWhaleEventType,
  getAccessiblePaperActionLabel,
  resolveAppRouteFromHash,
  resolvePageFromHash,
  summarizeMarketContext
} from "./view-model.js";

describe("web view model", () => {
  it("builds a paper-only long order payload with deterministic risk levels", () => {
    expect(buildPaperOrderPayload("BTC-USDT", 100_000, "BTC-USDT-fixed")).toEqual({
      idempotencyKey: "BTC-USDT-fixed",
      symbol: "BTC-USDT",
      side: "LONG",
      mode: "paper",
      entryPrice: 100_000,
      stopLossPrice: 98_000,
      takeProfitPrice: 104_000,
      marginUsdt: 100,
      leverage: 2
    });
  });

  it("formats informational signal directions without implying execution", () => {
    expect(formatSignalDirection("WATCH_LONG")).toBe("Observar LONG");
    expect(formatSignalDirection("NEUTRAL")).toBe("Neutro");
  });

  it("includes the symbol in the accessible paper action label", () => {
    expect(getAccessiblePaperActionLabel("ETH-USDT")).toBe("Simular LONG paper para ETH-USDT");
  });

  it("resolves page ids from hash fragments with a dashboard fallback", () => {
    expect(resolvePageFromHash("#alertas", ["dashboard", "alertas"])).toBe("alertas");
    expect(resolvePageFromHash("sinais", ["dashboard", "sinais"])).toBe("sinais");
    expect(resolvePageFromHash("#unknown", ["dashboard", "sinais"])).toBe("dashboard");
  });

  it("resolves the public landing as the empty route before the hub", () => {
    const hubPages = ["dashboard", "mercado", "sinais"] as const;

    expect(resolveAppRouteFromHash("", hubPages)).toBe("landing");
    expect(resolveAppRouteFromHash("#dashboard", hubPages)).toBe("dashboard");
    expect(resolveAppRouteFromHash("#mercado", hubPages)).toBe("mercado");
    expect(resolveAppRouteFromHash("#unknown", hubPages)).toBe("landing");
  });

  it("filters command items by label and keyword", () => {
    const items = [
      { id: "dashboard", label: "Dashboard", keywords: ["cockpit", "home"] },
      { id: "baleias", label: "Baleias", keywords: ["whales", "carteiras"] },
      { id: "risco", label: "Risco", keywords: ["roadmap", "backend"] }
    ];

    expect(filterCommandItems(items, "whale").map((item) => item.id)).toEqual(["baleias"]);
    expect(filterCommandItems(items, "back").map((item) => item.id)).toEqual(["risco"]);
    expect(filterCommandItems(items, "").map((item) => item.id)).toEqual(["dashboard", "baleias", "risco"]);
  });

  it("summarizes market context from tick direction and informational signals", () => {
    const ticks: MarketTick[] = [
      {
        symbol: "BTC-USDT",
        price: 100_000,
        change24hPct: 1.8,
        volume24h: 0,
        timestamp: 1,
        source: "simulated"
      },
      {
        symbol: "ETH-USDT",
        price: 3_000,
        change24hPct: 0.6,
        volume24h: 0,
        timestamp: 1,
        source: "simulated"
      }
    ];
    const signals: TradingSignal[] = [
      {
        id: "signal-1",
        symbol: "BTC-USDT",
        direction: "WATCH_LONG",
        confidence: "medium",
        priceChangePct: 1.8,
        shouldExecute: false,
        rationale: "Queda controlada dentro do limiar.",
        createdAt: "2026-05-01T00:00:00.000Z"
      }
    ];

    expect(summarizeMarketContext(ticks, signals)).toEqual({
      label: "Atenção compradora",
      score: 64,
      averageChangePct: 1.2,
      watchLongCount: 1
    });
  });

  it("formats live intelligence events for compact dashboard rows", () => {
    expect(formatWhaleEventType("EXCHANGE_INFLOW")).toBe("Entrada em exchange");
    expect(formatAlertStatus("OPEN")).toBe("ativo");
    expect(
      describeWhaleEvent({
        id: "whale-1",
        type: "EXCHANGE_OUTFLOW",
        symbol: "BTC",
        valueUsd: 5_000_000,
        severity: "medium",
        source: "simulated",
        timestamp: "2026-05-02T00:00:00.000Z"
      })
    ).toBe("BTC possivel retirada de oferta");
  });
});
