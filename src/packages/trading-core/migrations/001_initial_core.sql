CREATE TABLE IF NOT EXISTS order_intents (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  mode TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  stop_loss_price NUMERIC,
  take_profit_price NUMERIC,
  margin_usdt NUMERIC NOT NULL,
  leverage NUMERIC NOT NULL,
  status TEXT NOT NULL,
  rejection_reasons JSONB,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  order_intent_id TEXT NOT NULL REFERENCES order_intents(id),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  margin_usdt NUMERIC NOT NULL,
  leverage NUMERIC NOT NULL,
  notional NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  stop_loss_price NUMERIC,
  take_profit_price NUMERIC,
  pnl_usdt NUMERIC NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES positions(id),
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  mode TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC NOT NULL,
  pnl_usdt NUMERIC NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS market_ticks (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  price NUMERIC NOT NULL,
  change_24h_pct NUMERIC,
  volume_24h NUMERIC,
  timestamp_ms BIGINT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_ticks_symbol_timestamp ON market_ticks(symbol, timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
