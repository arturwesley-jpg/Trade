-- Additional Performance Indexes for Phase 9
-- Run after 001_initial_schema.sql and optimize_database.sql

-- ============================================================================
-- ADVANCED INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- Covering indexes for common queries (include frequently accessed columns)
CREATE INDEX IF NOT EXISTS idx_trades_user_covering ON trades(user_id, created_at DESC)
INCLUDE (symbol, side, price, quantity, status);

CREATE INDEX IF NOT EXISTS idx_positions_user_covering ON positions(user_id, status)
INCLUDE (symbol, side, entry_price, quantity, unrealized_pnl);

CREATE INDEX IF NOT EXISTS idx_orders_user_covering ON orders(user_id, status, created_at DESC)
INCLUDE (symbol, type, side, price, quantity);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_signals_rationale_gin ON signals USING GIN(rationale);
CREATE INDEX IF NOT EXISTS idx_signals_indicators_gin ON signals USING GIN(indicators);
CREATE INDEX IF NOT EXISTS idx_alerts_data_gin ON alerts USING GIN(data);
CREATE INDEX IF NOT EXISTS idx_audit_logs_details_gin ON audit_logs USING GIN(details);

-- BRIN indexes for time-series data (very efficient for large tables)
CREATE INDEX IF NOT EXISTS idx_market_ticks_timestamp_brin ON market_ticks USING BRIN(timestamp);
CREATE INDEX IF NOT EXISTS idx_ohlcv_candles_timestamp_brin ON ohlcv_candles USING BRIN(timestamp);
CREATE INDEX IF NOT EXISTS idx_sentiment_snapshots_timestamp_brin ON sentiment_snapshots USING BRIN(timestamp);

-- Hash indexes for exact equality lookups
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users USING HASH(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions USING HASH(token);

-- ============================================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================================================

-- Real-time trading dashboard metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS realtime_trading_metrics AS
SELECT
  symbol,
  COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '1 hour') as trades_1h,
  COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as trades_24h,
  AVG(price) FILTER (WHERE timestamp > NOW() - INTERVAL '1 hour') as avg_price_1h,
  AVG(volume) FILTER (WHERE timestamp > NOW() - INTERVAL '1 hour') as avg_volume_1h,
  MAX(price) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as high_24h,
  MIN(price) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as low_24h,
  SUM(volume) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as volume_24h
FROM market_ticks
GROUP BY symbol;

CREATE UNIQUE INDEX ON realtime_trading_metrics(symbol);

-- User portfolio summary
CREATE MATERIALIZED VIEW IF NOT EXISTS user_portfolio_summary AS
SELECT
  p.user_id,
  COUNT(*) as total_positions,
  COUNT(*) FILTER (WHERE p.status = 'OPEN') as open_positions,
  SUM(p.unrealized_pnl) FILTER (WHERE p.status = 'OPEN') as total_unrealized_pnl,
  SUM(p.realized_pnl) as total_realized_pnl,
  SUM(p.quantity * p.current_price) FILTER (WHERE p.status = 'OPEN') as portfolio_value,
  AVG(p.realized_pnl) FILTER (WHERE p.status = 'CLOSED') as avg_trade_pnl,
  COUNT(*) FILTER (WHERE p.status = 'CLOSED' AND p.realized_pnl > 0) as winning_trades,
  COUNT(*) FILTER (WHERE p.status = 'CLOSED' AND p.realized_pnl < 0) as losing_trades
FROM positions p
GROUP BY p.user_id;

CREATE UNIQUE INDEX ON user_portfolio_summary(user_id);

-- Signal performance tracking
CREATE MATERIALIZED VIEW IF NOT EXISTS signal_performance AS
SELECT
  s.symbol,
  s.type,
  COUNT(*) as total_signals,
  AVG(s.confidence) as avg_confidence,
  AVG(s.score) as avg_score,
  COUNT(*) FILTER (WHERE s.should_execute = true) as executable_signals,
  COUNT(*) FILTER (WHERE s.timestamp > NOW() - INTERVAL '24 hours') as signals_24h
FROM signals s
GROUP BY s.symbol, s.type;

CREATE UNIQUE INDEX ON signal_performance(symbol, type);

-- ============================================================================
-- FUNCTIONS FOR CACHE WARMING
-- ============================================================================

-- Function to warm up frequently accessed data
CREATE OR REPLACE FUNCTION warm_cache()
RETURNS void AS $$
BEGIN
  -- Refresh materialized views
  REFRESH MATERIALIZED VIEW CONCURRENTLY realtime_trading_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_portfolio_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY signal_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_trading_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY symbol_trading_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_trading_summary;

  -- Pre-load hot data into shared buffers
  PERFORM * FROM market_ticks WHERE timestamp > NOW() - INTERVAL '1 hour';
  PERFORM * FROM signals WHERE timestamp > NOW() - INTERVAL '1 hour';
  PERFORM * FROM positions WHERE status = 'OPEN';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- QUERY OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Function to get top performing symbols
CREATE OR REPLACE FUNCTION get_top_symbols(p_limit INT DEFAULT 10)
RETURNS TABLE (
  symbol VARCHAR,
  volume_24h DECIMAL,
  price_change_pct DECIMAL,
  trades_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mt.symbol,
    SUM(mt.volume) as volume_24h,
    ((MAX(mt.price) - MIN(mt.price)) / MIN(mt.price) * 100) as price_change_pct,
    COUNT(*) as trades_count
  FROM market_ticks mt
  WHERE mt.timestamp > NOW() - INTERVAL '24 hours'
  GROUP BY mt.symbol
  ORDER BY volume_24h DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get user performance metrics
CREATE OR REPLACE FUNCTION get_user_performance(p_user_id UUID)
RETURNS TABLE (
  total_trades BIGINT,
  winning_trades BIGINT,
  losing_trades BIGINT,
  win_rate DECIMAL,
  total_pnl DECIMAL,
  avg_pnl DECIMAL,
  best_trade DECIMAL,
  worst_trade DECIMAL,
  sharpe_ratio DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_trades,
    COUNT(*) FILTER (WHERE realized_pnl > 0) as winning_trades,
    COUNT(*) FILTER (WHERE realized_pnl < 0) as losing_trades,
    ROUND(
      COUNT(*) FILTER (WHERE realized_pnl > 0)::DECIMAL /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) as win_rate,
    ROUND(SUM(realized_pnl), 2) as total_pnl,
    ROUND(AVG(realized_pnl), 2) as avg_pnl,
    ROUND(MAX(realized_pnl), 2) as best_trade,
    ROUND(MIN(realized_pnl), 2) as worst_trade,
    CASE
      WHEN STDDEV(realized_pnl) > 0 THEN
        ROUND(AVG(realized_pnl) / STDDEV(realized_pnl), 2)
      ELSE 0
    END as sharpe_ratio
  FROM positions
  WHERE user_id = p_user_id AND status = 'CLOSED';
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- AUTOMATIC MAINTENANCE
-- ============================================================================

-- Function to clean old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Delete market ticks older than 30 days
  DELETE FROM market_ticks WHERE timestamp < NOW() - INTERVAL '30 days';

  -- Delete old audit logs (keep 90 days)
  DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '90 days';

  -- Delete expired sessions
  DELETE FROM sessions WHERE expires_at < NOW();

  -- Delete resolved alerts older than 30 days
  DELETE FROM alerts WHERE status = 'RESOLVED' AND resolved_at < NOW() - INTERVAL '30 days';

  -- Vacuum tables
  VACUUM ANALYZE market_ticks;
  VACUUM ANALYZE audit_logs;
  VACUUM ANALYZE sessions;
  VACUUM ANALYZE alerts;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERFORMANCE MONITORING VIEWS
-- ============================================================================

-- View for monitoring index usage
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- View for monitoring table bloat
CREATE OR REPLACE VIEW table_bloat_stats AS
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size,
  n_live_tup as live_tuples,
  n_dead_tup as dead_tuples,
  ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_tuple_pct
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- View for monitoring cache hit ratio
CREATE OR REPLACE VIEW cache_hit_ratio AS
SELECT
  'index hit rate' as metric,
  ROUND(sum(idx_blks_hit) * 100.0 / NULLIF(sum(idx_blks_hit + idx_blks_read), 0), 2) as ratio
FROM pg_statio_user_indexes
UNION ALL
SELECT
  'table hit rate' as metric,
  ROUND(sum(heap_blks_hit) * 100.0 / NULLIF(sum(heap_blks_hit + heap_blks_read), 0), 2) as ratio
FROM pg_statio_user_tables;
