import { DEFAULT_RISK_LIMITS, type OrderRequest, type RiskLimits } from "@trade/shared";

export interface RiskContext {
  accountEquity: number;
  currentDailyLoss: number;
  currentMonthlyDrawdownPct: number;
  openPositions: number;
  liveTradingEnabled?: boolean;
  limits?: Partial<RiskLimits>;
  request: OrderRequest;
}

export interface RiskDecision {
  approved: boolean;
  reasons: string[];
  riskAmount: number;
  riskPct: number;
  notional: number;
}

export function evaluateOrderRisk(context: RiskContext): RiskDecision {
  const limits = { ...DEFAULT_RISK_LIMITS, ...context.limits };
  const reasons: string[] = [];
  const { request } = context;
  const notional = roundMoney(request.marginUsdt * request.leverage);
  const stopDistancePct =
    request.stopLossPrice && request.entryPrice > 0
      ? Math.abs(request.entryPrice - request.stopLossPrice) / request.entryPrice
      : 0;
  const riskAmount = roundMoney(notional * stopDistancePct);
  const riskPct = context.accountEquity > 0 ? (riskAmount / context.accountEquity) * 100 : 100;

  if (!limits.allowedSymbols.includes(request.symbol)) {
    reasons.push("Symbol is not enabled for the MVP");
  }

  if (limits.longOnly && request.side !== "LONG") {
    reasons.push("Only long trades are enabled in the MVP");
  }

  if (!request.stopLossPrice) {
    reasons.push("Stop loss is required");
  }

  if (request.stopLossPrice && request.side === "LONG" && request.stopLossPrice >= request.entryPrice) {
    reasons.push("Long stop loss must be below entry price");
  }

  if (request.stopLossPrice && request.side === "SHORT" && request.stopLossPrice <= request.entryPrice) {
    reasons.push("Short stop loss must be above entry price");
  }

  if (request.mode === "live" && !context.liveTradingEnabled) {
    reasons.push("Live trading is disabled by default");
  }

  const maxLeverage = request.mode === "live" ? limits.maxLiveLeverage : limits.maxPaperLeverage;
  if (request.leverage > maxLeverage) {
    reasons.push("Leverage exceeds the maximum allowed for this mode");
  }

  if (request.marginUsdt <= 0 || request.entryPrice <= 0) {
    reasons.push("Margin and entry price must be positive");
  }

  if (riskPct > limits.maxRiskPctPerTrade) {
    reasons.push("Trade risk exceeds the configured limit");
  }

  if (context.openPositions >= limits.maxOpenPositions) {
    reasons.push("Maximum open positions limit reached");
  }

  if (context.currentDailyLoss >= (context.accountEquity * limits.maxDailyLossPct) / 100) {
    reasons.push("Daily loss circuit breaker is active");
  }

  if (context.currentMonthlyDrawdownPct >= limits.maxMonthlyDrawdownPct) {
    reasons.push("Monthly drawdown circuit breaker is active");
  }

  return {
    approved: reasons.length === 0,
    reasons,
    riskAmount,
    riskPct: roundMoney(riskPct),
    notional
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
