import type { AuditEvent, MarketTick, OrderIntent, Position, Trade } from "@trade/shared";
import { InMemoryTradingRepository, type RepositoryOptions, type TradingRepositorySnapshot } from "./repository.js";

export interface Queryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
}

export class PostgresTradingRepository extends InMemoryTradingRepository {
  private writeQueue = Promise.resolve();

  private constructor(private readonly client: Queryable, snapshot: TradingRepositorySnapshot, options: RepositoryOptions = {}) {
    super(snapshot, options);
  }

  static async create(client: Queryable, options: RepositoryOptions = {}): Promise<PostgresTradingRepository> {
    const snapshot = await loadSnapshot(client, options.maxMarketTicks ?? 1_000);
    return new PostgresTradingRepository(client, snapshot, options);
  }

  override saveIntent(intent: OrderIntent): void {
    super.saveIntent(intent);
    this.enqueue(
      `INSERT INTO order_intents (
        id, idempotency_key, symbol, side, mode, entry_price, stop_loss_price, take_profit_price,
        margin_usdt, leverage, status, rejection_reasons, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        rejection_reasons = EXCLUDED.rejection_reasons`,
      intentParams(intent)
    );
  }

  override updateIntent(intent: OrderIntent): void {
    super.updateIntent(intent);
    this.saveIntent(intent);
  }

  override savePosition(position: Position): void {
    super.savePosition(position);
    this.enqueue(
      `INSERT INTO positions (
        id, order_intent_id, symbol, side, mode, status, entry_price, exit_price, margin_usdt,
        leverage, notional, quantity, stop_loss_price, take_profit_price, pnl_usdt, opened_at, closed_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        exit_price = EXCLUDED.exit_price,
        pnl_usdt = EXCLUDED.pnl_usdt,
        closed_at = EXCLUDED.closed_at`,
      positionParams(position)
    );
  }

  override updatePosition(position: Position): void {
    super.updatePosition(position);
    this.savePosition(position);
  }

  override saveTrade(trade: Trade): void {
    super.saveTrade(trade);
    this.enqueue(
      `INSERT INTO trades (
        id, position_id, symbol, side, mode, entry_price, exit_price, pnl_usdt, opened_at, closed_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO NOTHING`,
      [
        trade.id,
        trade.positionId,
        trade.symbol,
        trade.side,
        trade.mode,
        trade.entryPrice,
        trade.exitPrice,
        trade.pnlUsdt,
        trade.openedAt,
        trade.closedAt
      ]
    );
  }

  override saveMarketTick(tick: MarketTick): void {
    super.saveMarketTick(tick);
    this.enqueue(
      `INSERT INTO market_ticks (symbol, price, change_24h_pct, volume_24h, timestamp_ms, source)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [tick.symbol, tick.price, tick.change24hPct ?? null, tick.volume24h ?? null, tick.timestamp, tick.source]
    );
  }

  override appendAudit(type: AuditEvent["type"], correlationId: string, payload: Record<string, unknown>): void {
    super.appendAudit(type, correlationId, payload);
    const event = this.auditEvents().at(-1);
    if (!event) return;
    this.enqueue(
      `INSERT INTO audit_events (id, type, correlation_id, timestamp, payload)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO NOTHING`,
      [event.id, event.type, event.correlationId, event.timestamp, JSON.stringify(event.payload)]
    );
  }

  async flush(): Promise<void> {
    await this.writeQueue;
  }

  private enqueue(sql: string, params: unknown[]): void {
    this.writeQueue = this.writeQueue.then(() => this.client.query(sql, params).then(() => undefined));
  }
}

async function loadSnapshot(client: Queryable, maxMarketTicks: number): Promise<TradingRepositorySnapshot> {
  const intents = await client.query("SELECT * FROM order_intents ORDER BY created_at ASC");
  const positions = await client.query("SELECT * FROM positions ORDER BY opened_at ASC");
  const trades = await client.query("SELECT * FROM trades ORDER BY closed_at ASC");
  const auditEvents = await client.query("SELECT * FROM audit_events ORDER BY timestamp ASC");
  const marketTicks = await client.query("SELECT * FROM market_ticks ORDER BY timestamp_ms DESC LIMIT $1", [maxMarketTicks]);

  return {
    orderIntents: intents.rows.map(mapIntent),
    positions: positions.rows.map(mapPosition),
    trades: trades.rows.map(mapTrade),
    auditEvents: auditEvents.rows.map(mapAuditEvent),
    marketTicks: marketTicks.rows.map(mapMarketTick).reverse()
  };
}

function intentParams(intent: OrderIntent): unknown[] {
  return [
    intent.id,
    intent.idempotencyKey,
    intent.symbol,
    intent.side,
    intent.mode,
    intent.entryPrice,
    intent.stopLossPrice ?? null,
    intent.takeProfitPrice ?? null,
    intent.marginUsdt,
    intent.leverage,
    intent.status,
    intent.rejectionReasons ? JSON.stringify(intent.rejectionReasons) : null,
    intent.createdAt
  ];
}

function positionParams(position: Position): unknown[] {
  return [
    position.id,
    position.orderIntentId,
    position.symbol,
    position.side,
    position.mode,
    position.status,
    position.entryPrice,
    position.exitPrice ?? null,
    position.marginUsdt,
    position.leverage,
    position.notional,
    position.quantity,
    position.stopLossPrice ?? null,
    position.takeProfitPrice ?? null,
    position.pnlUsdt,
    position.openedAt,
    position.closedAt ?? null
  ];
}

function mapIntent(row: Record<string, unknown>): OrderIntent {
  return {
    id: stringValue(row.id),
    idempotencyKey: stringValue(row.idempotency_key),
    symbol: stringValue(row.symbol),
    side: stringValue(row.side) as OrderIntent["side"],
    mode: stringValue(row.mode) as OrderIntent["mode"],
    entryPrice: numberValue(row.entry_price),
    stopLossPrice: optionalNumber(row.stop_loss_price),
    takeProfitPrice: optionalNumber(row.take_profit_price),
    marginUsdt: numberValue(row.margin_usdt),
    leverage: numberValue(row.leverage),
    status: stringValue(row.status) as OrderIntent["status"],
    rejectionReasons: Array.isArray(row.rejection_reasons) ? (row.rejection_reasons as string[]) : undefined,
    createdAt: dateString(row.created_at)
  };
}

function mapPosition(row: Record<string, unknown>): Position {
  return {
    id: stringValue(row.id),
    orderIntentId: stringValue(row.order_intent_id),
    symbol: stringValue(row.symbol),
    side: stringValue(row.side) as Position["side"],
    mode: stringValue(row.mode) as Position["mode"],
    status: stringValue(row.status) as Position["status"],
    entryPrice: numberValue(row.entry_price),
    exitPrice: optionalNumber(row.exit_price),
    marginUsdt: numberValue(row.margin_usdt),
    leverage: numberValue(row.leverage),
    notional: numberValue(row.notional),
    quantity: numberValue(row.quantity),
    stopLossPrice: optionalNumber(row.stop_loss_price),
    takeProfitPrice: optionalNumber(row.take_profit_price),
    pnlUsdt: numberValue(row.pnl_usdt),
    openedAt: dateString(row.opened_at),
    closedAt: optionalDateString(row.closed_at)
  };
}

function mapTrade(row: Record<string, unknown>): Trade {
  return {
    id: stringValue(row.id),
    positionId: stringValue(row.position_id),
    symbol: stringValue(row.symbol),
    side: stringValue(row.side) as Trade["side"],
    mode: stringValue(row.mode) as Trade["mode"],
    entryPrice: numberValue(row.entry_price),
    exitPrice: numberValue(row.exit_price),
    pnlUsdt: numberValue(row.pnl_usdt),
    marginUsdt: numberValue(row.margin_usdt ?? 0),
    status: (stringValue(row.status) as Trade["status"]) ?? "CLOSED",
    openedAt: dateString(row.opened_at),
    closedAt: dateString(row.closed_at)
  };
}

function mapAuditEvent(row: Record<string, unknown>): AuditEvent {
  return {
    id: stringValue(row.id),
    type: stringValue(row.type) as AuditEvent["type"],
    correlationId: stringValue(row.correlation_id),
    timestamp: dateString(row.timestamp),
    payload: isRecord(row.payload) ? row.payload : {}
  };
}

function mapMarketTick(row: Record<string, unknown>): MarketTick {
  return {
    symbol: stringValue(row.symbol),
    price: numberValue(row.price),
    change24hPct: optionalNumber(row.change_24h_pct),
    volume24h: optionalNumber(row.volume_24h),
    timestamp: numberValue(row.timestamp_ms),
    source: stringValue(row.source) as MarketTick["source"]
  };
}

function stringValue(value: unknown): string {
  return String(value ?? "");
}

function numberValue(value: unknown): number {
  return Number(value);
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  return Number(value);
}

function dateString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : stringValue(value);
}

function optionalDateString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return dateString(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
