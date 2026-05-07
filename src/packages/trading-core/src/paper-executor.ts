import {
  createId,
  type OrderIntent,
  type OpenPaperOrderRequest,
  type Position,
  type Trade
} from "@trade/shared";
import { evaluateOrderRisk, type RiskContext } from "./risk-engine.js";
import type { TradingRepository } from "./repository.js";

export interface PaperExecutorConfig {
  makerFeePct?: number;
  takerFeePct?: number;
  slippagePct?: number;
}

export class PaperExecutor {
  private readonly makerFeePct: number;
  private readonly takerFeePct: number;
  private readonly slippagePct: number;

  constructor(
    private readonly repo: TradingRepository,
    private readonly riskContext: Omit<RiskContext, "request">,
    config: PaperExecutorConfig = {}
  ) {
    this.makerFeePct = config.makerFeePct ?? Number(process.env.PAPER_MAKER_FEE_PCT ?? 0.075);
    this.takerFeePct = config.takerFeePct ?? Number(process.env.PAPER_TAKER_FEE_PCT ?? 0.075);
    this.slippagePct = config.slippagePct ?? Number(process.env.PAPER_SLIPPAGE_PCT ?? 0.05);
  }

  async open(request: OpenPaperOrderRequest): Promise<{ position: Position; intent: OrderIntent }> {
    const existing = this.repo.findIntentByIdempotencyKey(request.idempotencyKey);
    if (existing) {
      const existingPosition = this.findPositionByIntent(existing.id);
      if (!existingPosition) {
        throw new Error("Idempotent order intent exists without a position");
      }
      this.repo.appendAudit("ORDER_INTENT_DEDUPED", existing.id, { idempotencyKey: request.idempotencyKey });
      return { position: existingPosition, intent: { ...existing, status: "DEDUPED" } };
    }

    const intent: OrderIntent = {
      ...request,
      id: createId("intent"),
      createdAt: new Date().toISOString(),
      status: "CREATED"
    };
    this.repo.saveIntent(intent);
    this.repo.appendAudit("ORDER_INTENT_CREATED", intent.id, { request });

    const decision = evaluateOrderRisk({ ...this.riskContext, request });
    if (!decision.approved) {
      const rejected = { ...intent, status: "REJECTED" as const, rejectionReasons: decision.reasons };
      this.repo.updateIntent(rejected);
      this.repo.appendAudit("RISK_CHECK_FAILED", intent.id, { decision });
      throw new Error(`Order rejected: ${decision.reasons.join("; ")}`);
    }

    // Apply slippage to entry price (market orders)
    const slippageMultiplier = 1 + (this.slippagePct / 100);
    const adjustedEntryPrice = request.side === "LONG"
      ? request.entryPrice * slippageMultiplier
      : request.entryPrice / slippageMultiplier;

    // Calculate notional and quantity with adjusted price
    const notional = decision.notional;
    const quantity = notional / adjustedEntryPrice;

    // Calculate entry fees (taker fee for market orders)
    const entryFeeUsdt = notional * (this.takerFeePct / 100);
    const effectiveMargin = request.marginUsdt - entryFeeUsdt;

    const position: Position = {
      id: createId("pos"),
      orderIntentId: intent.id,
      symbol: request.symbol,
      side: request.side,
      mode: request.mode,
      status: "OPEN",
      entryPrice: adjustedEntryPrice,
      marginUsdt: effectiveMargin,
      leverage: request.leverage,
      notional,
      quantity,
      stopLossPrice: request.stopLossPrice,
      takeProfitPrice: request.takeProfitPrice,
      pnlUsdt: -entryFeeUsdt,
      openedAt: new Date().toISOString()
    };

    this.repo.savePosition(position);
    this.repo.updateIntent({ ...intent, status: "EXECUTED" });
    this.repo.appendAudit("PAPER_POSITION_OPENED", intent.id, { position });

    return { position, intent: { ...intent, status: "EXECUTED" } };
  }

  async close(positionId: string, exitPrice: number): Promise<Position> {
    const position = this.repo.getPosition(positionId);
    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }
    if (position.status === "CLOSED") {
      return position;
    }

    // Apply slippage to exit price
    const slippageMultiplier = 1 + (this.slippagePct / 100);
    const adjustedExitPrice = position.side === "LONG"
      ? exitPrice / slippageMultiplier
      : exitPrice * slippageMultiplier;

    // Calculate PnL before fees
    const priceDelta = position.side === "LONG"
      ? adjustedExitPrice - position.entryPrice
      : position.entryPrice - adjustedExitPrice;
    const grossPnlUsdt = priceDelta * position.quantity;

    // Calculate exit fees (taker fee for market orders)
    const exitFeeUsdt = position.notional * (this.takerFeePct / 100);

    // Final PnL includes entry fee (already in position.pnlUsdt), gross PnL, and exit fee
    const finalPnlUsdt = Math.round((position.pnlUsdt + grossPnlUsdt - exitFeeUsdt) * 100) / 100;

    const closedAt = new Date().toISOString();
    const closed: Position = {
      ...position,
      status: "CLOSED",
      exitPrice: adjustedExitPrice,
      pnlUsdt: finalPnlUsdt,
      closedAt
    };
    const trade: Trade = {
      id: createId("trade"),
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      mode: position.mode,
      entryPrice: position.entryPrice,
      exitPrice: adjustedExitPrice,
      pnlUsdt: finalPnlUsdt,
      marginUsdt: position.marginUsdt,
      status: "CLOSED",
      openedAt: position.openedAt,
      closedAt
    };

    this.repo.updatePosition(closed);
    this.repo.saveTrade(trade);
    this.repo.appendAudit("PAPER_POSITION_CLOSED", position.orderIntentId, { trade });

    return closed;
  }

  private findPositionByIntent(intentId: string): Position | undefined {
    const repoWithSnapshot = this.repo as TradingRepository & { positions?: () => Position[] };
    return repoWithSnapshot.positions?.().find((position) => position.orderIntentId === intentId);
  }
}
