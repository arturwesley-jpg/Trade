import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createId, type AuditEvent, type MarketTick, type OrderIntent, type Position, type Trade } from "@trade/shared";

export interface TradingRepositorySnapshot {
  orderIntents: OrderIntent[];
  positions: Position[];
  trades: Trade[];
  auditEvents: AuditEvent[];
  marketTicks: MarketTick[];
}

export interface RepositoryOptions {
  maxMarketTicks?: number;
}

export interface TradingRepository {
  findIntentByIdempotencyKey(idempotencyKey: string): OrderIntent | undefined;
  saveIntent(intent: OrderIntent): void;
  updateIntent(intent: OrderIntent): void;
  savePosition(position: Position): void;
  updatePosition(position: Position): void;
  getPosition(id: string): Position | undefined;
  saveTrade(trade: Trade): void;
  saveMarketTick(tick: MarketTick): void;
  appendAudit(type: AuditEvent["type"], correlationId: string, payload: Record<string, unknown>): void;
  snapshot(): TradingRepositorySnapshot;
}

export class InMemoryTradingRepository implements TradingRepository {
  private readonly orderIntents = new Map<string, OrderIntent>();
  private readonly orderIntentsByKey = new Map<string, string>();
  private readonly positionRecords = new Map<string, Position>();
  private readonly tradeRecords: Trade[] = [];
  private readonly auditRecords: AuditEvent[] = [];
  private readonly marketTickRecords: MarketTick[] = [];
  private readonly maxMarketTicks: number;

  constructor(snapshot?: Partial<TradingRepositorySnapshot>, options: RepositoryOptions = {}) {
    this.maxMarketTicks = options.maxMarketTicks ?? 1_000;
    for (const intent of snapshot?.orderIntents ?? []) {
      this.orderIntents.set(intent.id, intent);
      this.orderIntentsByKey.set(intent.idempotencyKey, intent.id);
    }
    for (const position of snapshot?.positions ?? []) {
      this.positionRecords.set(position.id, position);
    }
    this.tradeRecords.push(...(snapshot?.trades ?? []));
    this.auditRecords.push(...(snapshot?.auditEvents ?? []));
    this.marketTickRecords.push(...(snapshot?.marketTicks ?? []).slice(-this.maxMarketTicks));
  }

  findIntentByIdempotencyKey(idempotencyKey: string): OrderIntent | undefined {
    const intentId = this.orderIntentsByKey.get(idempotencyKey);
    return intentId ? this.orderIntents.get(intentId) : undefined;
  }

  saveIntent(intent: OrderIntent): void {
    this.orderIntents.set(intent.id, intent);
    this.orderIntentsByKey.set(intent.idempotencyKey, intent.id);
  }

  updateIntent(intent: OrderIntent): void {
    this.orderIntents.set(intent.id, intent);
  }

  savePosition(position: Position): void {
    this.positionRecords.set(position.id, position);
  }

  updatePosition(position: Position): void {
    this.positionRecords.set(position.id, position);
  }

  getPosition(id: string): Position | undefined {
    return this.positionRecords.get(id);
  }

  saveTrade(trade: Trade): void {
    this.tradeRecords.push(trade);
  }

  saveMarketTick(tick: MarketTick): void {
    this.marketTickRecords.push(tick);
    if (this.marketTickRecords.length > this.maxMarketTicks) {
      this.marketTickRecords.splice(0, this.marketTickRecords.length - this.maxMarketTicks);
    }
  }

  appendAudit(type: AuditEvent["type"], correlationId: string, payload: Record<string, unknown>): void {
    this.auditRecords.push({
      id: createId("audit"),
      type,
      correlationId,
      timestamp: new Date().toISOString(),
      payload
    });
  }

  intents(): OrderIntent[] {
    return [...this.orderIntents.values()];
  }

  positions(): Position[] {
    return [...this.positionRecords.values()];
  }

  trades(): Trade[] {
    return [...this.tradeRecords];
  }

  auditEvents(): AuditEvent[] {
    return [...this.auditRecords];
  }

  marketTicks(): MarketTick[] {
    return [...this.marketTickRecords];
  }

  snapshot(): TradingRepositorySnapshot {
    return cloneSnapshot({
      orderIntents: this.intents(),
      positions: this.positions(),
      trades: this.trades(),
      auditEvents: this.auditEvents(),
      marketTicks: this.marketTicks()
    });
  }
}

export class JsonFileTradingRepository extends InMemoryTradingRepository {
  constructor(private readonly filePath: string, options: RepositoryOptions = {}) {
    super(loadSnapshot(filePath), options);
  }

  override saveIntent(intent: OrderIntent): void {
    super.saveIntent(intent);
    this.persist();
  }

  override updateIntent(intent: OrderIntent): void {
    super.updateIntent(intent);
    this.persist();
  }

  override savePosition(position: Position): void {
    super.savePosition(position);
    this.persist();
  }

  override updatePosition(position: Position): void {
    super.updatePosition(position);
    this.persist();
  }

  override saveTrade(trade: Trade): void {
    super.saveTrade(trade);
    this.persist();
  }

  override saveMarketTick(tick: MarketTick): void {
    super.saveMarketTick(tick);
    this.persist();
  }

  override appendAudit(type: AuditEvent["type"], correlationId: string, payload: Record<string, unknown>): void {
    super.appendAudit(type, correlationId, payload);
    this.persist();
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(this.snapshot(), null, 2)}\n`, "utf8");
    renameSync(tempPath, this.filePath);
  }
}

function loadSnapshot(filePath: string): TradingRepositorySnapshot | undefined {
  if (!existsSync(filePath)) return undefined;
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<TradingRepositorySnapshot>;
  return {
    orderIntents: parsed.orderIntents ?? [],
    positions: parsed.positions ?? [],
    trades: parsed.trades ?? [],
    auditEvents: parsed.auditEvents ?? [],
    marketTicks: parsed.marketTicks ?? []
  };
}

function cloneSnapshot(snapshot: TradingRepositorySnapshot): TradingRepositorySnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as TradingRepositorySnapshot;
}
