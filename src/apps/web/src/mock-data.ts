import type { CandlestickData, LineData } from "lightweight-charts";
import type { Trade } from "./components/TradesHistory.js";

// Generate mock candlestick data
export function generateMockCandlestickData(symbol: string, days: number = 30): CandlestickData[] {
  const data: CandlestickData[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  let basePrice = symbol === "BTCUSDT" ? 65000 : symbol === "ETHUSDT" ? 3200 : 100;

  for (let i = days; i >= 0; i--) {
    const time = Math.floor((now - i * dayMs) / 1000) as any;

    // Random walk with trend
    const change = (Math.random() - 0.48) * basePrice * 0.03;
    basePrice += change;

    const open = basePrice;
    const close = basePrice + (Math.random() - 0.5) * basePrice * 0.02;
    const high = Math.max(open, close) + Math.random() * basePrice * 0.015;
    const low = Math.min(open, close) - Math.random() * basePrice * 0.015;

    data.push({
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2))
    });
  }

  return data;
}

// Generate mock equity curve data
export function generateMockEquityCurve(trades: Trade[]): LineData[] {
  if (trades.length === 0) {
    // Generate sample equity curve
    const data: LineData[] = [];
    const startCapital = 10000;
    let equity = startCapital;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 30; i >= 0; i--) {
      const time = Math.floor((now - i * dayMs) / 1000) as any;
      equity += (Math.random() - 0.45) * 200; // Slight upward bias
      data.push({
        time,
        value: Number(equity.toFixed(2))
      });
    }

    return data;
  }

  // Build equity curve from actual trades
  const data: LineData[] = [];
  let equity = 10000; // Starting capital

  const sortedTrades = [...trades].sort((a, b) => a.exitTime - b.exitTime);

  for (const trade of sortedTrades) {
    equity += trade.pnl;
    data.push({
      time: Math.floor(trade.exitTime / 1000) as any,
      value: Number(equity.toFixed(2))
    });
  }

  return data;
}

// Generate mock trades history
export function generateMockTrades(count: number = 50): Trade[] {
  const trades: Trade[] = [];
  const symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT"];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const entryTime = now - Math.floor(Math.random() * 30 * dayMs);
    const duration = Math.floor(Math.random() * 12 * 60 * 60 * 1000); // 0-12 hours
    const exitTime = entryTime + duration;

    const entryPrice = Math.random() * 1000 + 100;
    const pnlPercent = (Math.random() - 0.45) * 10; // -4.5% to 5.5% (slight win bias)
    const exitPrice = entryPrice * (1 + pnlPercent / 100);

    const marginUsdt = 100;
    const leverage = Math.floor(Math.random() * 5) + 1;
    const pnl = marginUsdt * leverage * (pnlPercent / 100);

    const status: "WIN" | "LOSS" | "BREAKEVEN" =
      pnl > 5 ? "WIN" : pnl < -5 ? "LOSS" : "BREAKEVEN";

    trades.push({
      id: `trade-${i}-${entryTime}`,
      symbol,
      side: Math.random() > 0.5 ? "LONG" : "SHORT",
      entryPrice: Number(entryPrice.toFixed(2)),
      exitPrice: Number(exitPrice.toFixed(2)),
      entryTime,
      exitTime,
      pnl: Number(pnl.toFixed(2)),
      pnlPercent: Number(pnlPercent.toFixed(2)),
      marginUsdt,
      leverage,
      status
    });
  }

  return trades.sort((a, b) => b.exitTime - a.exitTime);
}
