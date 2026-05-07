-- Migration: 001_initial_schema
-- Description: Create initial database schema for Trading Bot
-- Date: 2026-05-05

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Market Ticks Table
CREATE TABLE IF NOT EXISTS market_ticks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(20) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  volume DECIMAL(20, 8) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  provider VARCHAR(50) NOT NULL,
  quality_score DECIMAL(3, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_ticks_symbol_timestamp ON market_ticks(symbol, timestamp DESC);
CREATE INDEX idx_market_ticks_provider ON market_ticks(provider);
CREATE INDEX idx_market_ticks_timestamp ON market_ticks(timestamp DESC);

-- OHLCV Candles Table
CREATE TABLE IF NOT EXISTS ohlcv_candles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(20) NOT NULL,
  interval VARCHAR(10) NOT NULL,
  open DECIMAL(20, 8) NOT NULL,
  high DECIMAL(20, 8) NOT NULL,
  low DECIMAL(20, 8) NOT NULL,
  close DECIMAL(20, 8) NOT NULL,
  volume DECIMAL(20, 8) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (symbol, interval, timestamp)
);

CREATE INDEX idx_ohlcv_candles_symbol_interval_timestamp ON ohlcv_candles(symbol, interval, timestamp DESC);
CREATE INDEX idx_ohlcv_candles_timestamp ON ohlcv_candles(timestamp DESC);

-- Signals Table
CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(20) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('BUY', 'SELL', 'NEUTRAL')),
  confidence DECIMAL(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  score DECIMAL(5, 2) NOT NULL,
  rationale JSONB NOT NULL,
  indicators JSONB NOT NULL,
  sentiment_score DECIMAL(3, 2),
  whale_impact DECIMAL(3, 2),
  should_execute BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signals_symbol_timestamp ON signals(symbol, timestamp DESC);
CREATE INDEX idx_signals_type ON signals(type);
CREATE INDEX idx_signals_should_execute ON signals(should_execute);
CREATE INDEX idx_signals_timestamp ON signals(timestamp DESC);

-- Positions Table
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('LONG', 'SHORT')),
  entry_price DECIMAL(20, 8) NOT NULL,
  current_price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  leverage INTEGER NOT NULL DEFAULT 1,
  stop_loss DECIMAL(20, 8),
  take_profit DECIMAL(20, 8),
  unrealized_pnl DECIMAL(20, 8) DEFAULT 0,
  realized_pnl DECIMAL(20, 8) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  mode VARCHAR(10) NOT NULL CHECK (mode IN ('PAPER', 'LIVE')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_positions_symbol ON positions(symbol);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_mode ON positions(mode);
CREATE INDEX idx_positions_opened_at ON positions(opened_at DESC);

-- Trades Table
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_id UUID REFERENCES positions(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(10) NOT NULL CHECK (side IN ('BUY', 'SELL')),
  price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  fee DECIMAL(20, 8) NOT NULL DEFAULT 0,
  pnl DECIMAL(20, 8),
  mode VARCHAR(10) NOT NULL CHECK (mode IN ('PAPER', 'LIVE')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trades_position_id ON trades(position_id);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_mode ON trades(mode);
CREATE INDEX idx_trades_timestamp ON trades(timestamp DESC);

-- Alert Rules Table
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  conditions JSONB NOT NULL,
  actions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX idx_alert_rules_type ON alert_rules(type);

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_rule_id ON alerts(rule_id);
CREATE INDEX idx_alerts_status_created ON alerts(status, created_at DESC);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);

-- Whale Events Table
CREATE TABLE IF NOT EXISTS whale_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  usd_value DECIMAL(20, 2),
  source VARCHAR(100),
  destination VARCHAR(100),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whale_events_symbol_timestamp ON whale_events(symbol, timestamp DESC);
CREATE INDEX idx_whale_events_event_type ON whale_events(event_type);
CREATE INDEX idx_whale_events_severity ON whale_events(severity);
CREATE INDEX idx_whale_events_timestamp ON whale_events(timestamp DESC);

-- News Events Table
CREATE TABLE IF NOT EXISTS news_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  content TEXT,
  source VARCHAR(100) NOT NULL,
  url VARCHAR(500),
  sentiment VARCHAR(20) CHECK (sentiment IN ('POSITIVE', 'NEGATIVE', 'NEUTRAL')),
  sentiment_score DECIMAL(3, 2),
  symbols TEXT[], -- Array of symbols
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_news_events_published_at ON news_events(published_at DESC);
CREATE INDEX idx_news_events_sentiment ON news_events(sentiment);
CREATE INDEX idx_news_events_source ON news_events(source);
CREATE INDEX idx_news_events_symbols ON news_events USING GIN(symbols);

-- Sentiment Snapshots Table
CREATE TABLE IF NOT EXISTS sentiment_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol VARCHAR(20) NOT NULL,
  source VARCHAR(50) NOT NULL,
  score DECIMAL(3, 2) NOT NULL,
  volume INTEGER NOT NULL DEFAULT 0,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  neutral_count INTEGER NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sentiment_snapshots_symbol_timestamp ON sentiment_snapshots(symbol, timestamp DESC);
CREATE INDEX idx_sentiment_snapshots_source ON sentiment_snapshots(source);
CREATE INDEX idx_sentiment_snapshots_timestamp ON sentiment_snapshots(timestamp DESC);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id VARCHAR(100),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Create materialized view for performance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS trading_metrics AS
SELECT
  mode,
  COUNT(*) FILTER (WHERE status = 'CLOSED') as total_trades,
  COUNT(*) FILTER (WHERE status = 'CLOSED' AND realized_pnl > 0) as winning_trades,
  COUNT(*) FILTER (WHERE status = 'CLOSED' AND realized_pnl < 0) as losing_trades,
  ROUND(AVG(realized_pnl) FILTER (WHERE status = 'CLOSED'), 2) as avg_pnl,
  ROUND(SUM(realized_pnl) FILTER (WHERE status = 'CLOSED'), 2) as total_pnl,
  ROUND(MAX(realized_pnl) FILTER (WHERE status = 'CLOSED'), 2) as max_win,
  ROUND(MIN(realized_pnl) FILTER (WHERE status = 'CLOSED'), 2) as max_loss,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'CLOSED' AND realized_pnl > 0)::DECIMAL /
    NULLIF(COUNT(*) FILTER (WHERE status = 'CLOSED'), 0) * 100,
    2
  ) as win_rate
FROM positions
GROUP BY mode;

CREATE UNIQUE INDEX idx_trading_metrics_mode ON trading_metrics(mode);

-- Create function to refresh metrics
CREATE OR REPLACE FUNCTION refresh_trading_metrics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY trading_metrics;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default alert rules
INSERT INTO alert_rules (name, type, conditions, actions, enabled) VALUES
  ('Price Alert', 'PRICE', '{"threshold": 0.05}', '{"notify": true}', true),
  ('Volume Spike', 'VOLUME', '{"multiplier": 2}', '{"notify": true}', true),
  ('Whale Activity', 'WHALE', '{"minAmount": 1000000}', '{"notify": true}', true),
  ('High Confidence Signal', 'SIGNAL', '{"minConfidence": 0.8}', '{"notify": true}', true)
ON CONFLICT DO NOTHING;
