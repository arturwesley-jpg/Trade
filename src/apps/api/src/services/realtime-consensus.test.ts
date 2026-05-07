import { describe, expect, it } from "vitest";
import { RealTimeConsensusService } from "./realtime-consensus.js";

describe("RealTimeConsensusService", () => {
  it("builds a validated signal with enough agreeing providers", () => {
    const service = new RealTimeConsensusService({
      symbols: ["BTC-USDT"],
      providers: ["binance", "bybit", "okx", "kraken", "coinbase"]
    });
    const now = Date.now();

    service.ingestQuote({ symbol: "BTC-USDT", price: 100000, timestamp: now, source: "binance" });
    service.ingestQuote({ symbol: "BTC-USDT", price: 100010, timestamp: now, source: "bybit" });
    const result = service.ingestQuote({ symbol: "BTC-USDT", price: 100005, timestamp: now, source: "okx" });

    expect(result.consensusTick).toEqual(expect.objectContaining({
      symbol: "BTC-USDT",
      source: "consensus",
      status: "PRECO VALIDADO"
    }));
    expect(result.signal.status).toBe("PRECO VALIDADO");
    expect(result.providerStatus.providers.binance?.healthy).toBe(true);
  });

  it("emits weak signal when primary confirmation is missing", () => {
    const service = new RealTimeConsensusService({
      symbols: ["SOL-USDT"],
      providers: ["binance", "bybit", "okx", "kraken", "coinbase", "coinpaprika"]
    });
    const now = Date.now();

    service.ingestQuote({ symbol: "SOL-USDT", price: 150, timestamp: now, source: "kraken" });
    service.ingestQuote({ symbol: "SOL-USDT", price: 150.1, timestamp: now, source: "coinbase" });
    const result = service.ingestQuote({ symbol: "SOL-USDT", price: 149.95, timestamp: now, source: "coinpaprika" });

    expect(result.signal.status).toBe("SINAL FRACO");
  });
});
