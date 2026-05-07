import { createId, type TradingSignal } from "@trade/shared";

export interface SignalInput {
  symbol: string;
  prices: number[];
  thresholdPct: number;
}

export function evaluateSignal(input: SignalInput): TradingSignal {
  const first = input.prices[0];
  const last = input.prices.at(-1);
  if (!first || !last || input.prices.length < 2) {
    return neutralSignal(input.symbol, 0, "Not enough market data to evaluate a signal");
  }

  const priceChangePct = round(((last - first) / first) * 100);
  if (priceChangePct <= -Math.abs(input.thresholdPct)) {
    return {
      id: createId("signal"),
      symbol: input.symbol,
      direction: "WATCH_LONG",
      confidence: "medium",
      priceChangePct,
      shouldExecute: false,
      rationale: `${input.symbol} moved ${Math.abs(priceChangePct)}%, crossing the ${input.thresholdPct}% watch threshold. This is an informational long-watch signal, not an execution instruction.`,
      createdAt: new Date().toISOString()
    };
  }

  return neutralSignal(
    input.symbol,
    priceChangePct,
    `${input.symbol} movement is ${Math.abs(priceChangePct)}%, below the ${input.thresholdPct}% signal threshold.`
  );
}

function neutralSignal(symbol: string, priceChangePct: number, rationale: string): TradingSignal {
  return {
    id: createId("signal"),
    symbol,
    direction: "NEUTRAL",
    confidence: "low",
    priceChangePct,
    shouldExecute: false,
    rationale,
    createdAt: new Date().toISOString()
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
