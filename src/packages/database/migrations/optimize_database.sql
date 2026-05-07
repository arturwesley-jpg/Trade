-- Database Optimization Script for Trading Bot
-- Creates indexes, optimizes queries, and improves performance

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status) WHERE status = 'active';

-- Sessions table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(user_id, expires_at) WHERE expires_at > NOW();

-- Trades table indexes
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_user_symbol ON trades(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_trades_user_status ON trades(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_user_created ON trades(user_id, created_at DESC);

-- Positions table indexes
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_user_symbol ON positions(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_positions_active ON positions(user_id, status) WHERE status = 'open';

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(type);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(user_id, status) WHERE status = 'pending';

-- Market data indexes
CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_time ON market_data(symbol, timestamp DESC);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);

-- ============================================================================
-- PARTIAL INDEXES FOR SPECIFIC QUERIES
-- ============================================================================

-- Active trades only
CREATE INDEX IF NOT EXISTS idx_trades_active ON trades(user_id, created_at DESC)
WHERE status IN ('pending', 'executed');

-- Open positions only
CREATE INDEX IF NOT EXISTS idx_positions_open ON positions(user_id, symbol)
WHERE status = 'open';

-- Pending orders only
CREATE INDEX IF NOT EXISTS idx_orders_pending_user ON orders(user_id, created_at DESC)
WHERE status = 'pending';

-- Recent market data (last 24 hours)
CREATE INDEX IF NOT EXISTS idx_market_data_recent ON market_data(symbol, timestamp DESC)
WHERE timestamp > NOW() - INTERVAL '24 hours';

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- User trades with filters
CREATE INDEX IF NOT EXISTS idx_trades_user_symbol_status_time ON trades(user_id, symbol, status, created_at DESC);

-- User positions with filters
CREATE INDEX IF NOT EXISTS idx_positions_user_symbol_status ON positions(user_id, symbol, status);

-- Orders with multiple filters
CREATE INDEX IF NOT EXISTS idx_orders_user_symbol_status_type ON orders(user_id, symbol, status, type);

-- ============================================================================
-- MATERIALIZED VIEWS FOR AGGREGATIONS
-- ============================================================================

-- User trading statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS user_trading_stats AS
SELECT
    user_id,
    COUNT(*) as total_trades,
    SUM(CASE WHEN status = 'executed' THEN 1 ELSE 0 END) as executed_trades,
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_trades,
    SUM(quantity * price) as total_volume,
    AVG(price) as avg_price,
    MIN(created_at) as first_trade,
    MAX(created_at) as last_trade
FROM trades
GROUP BY user_id;

CREATE UNIQUE INDEX ON user_trading_stats(user_id);

-- Symbol trading statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS symbol_trading_stats AS
SELECT
    symbol,
    COUNT(*) as total_trades,
    SUM(quantity) as total_quantity,
    SUM(quantity * price) as total_volume,
    AVG(price) as avg_price,
    MIN(price) as min_price,
    MAX(price) as max_price,
    MAX(created_at) as last_trade_time
FROM trades
WHERE status = 'executed'
GROUP BY symbol;

CREATE UNIQUE INDEX ON symbol_trading_stats(symbol);

-- Daily trading summary
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_trading_summary AS
SELECT
    DATE(created_at) as trade_date,
    symbol,
    COUNT(*) as trade_count,
    SUM(quantity) as total_quantity,
    SUM(quantity * price) as total_volume,
    AVG(price) as avg_price,
    MIN(price) as low_price,
    MAX(price) as high_price,
    (SELECT price FROM trades t2 WHERE t2.symbol = trades.symbol AND DATE(t2.created_at) = DATE(trades.created_at) ORDER BY t2.created_at ASC LIMIT 1) as open_price,
    (SELECT price FROM trades t2 WHERE t2.symbol = trades.symbol AND DATE(t2.created_at) = DATE(trades.created_at) ORDER BY t2.created_at DESC LIMIT 1) as close_price
FROM trades
WHERE status = 'executed'
GROUP BY DATE(created_at), symbol;

CREATE UNIQUE INDEX ON daily_trading_summary(trade_date, symbol);

-- ============================================================================
-- REFRESH MATERIALIZED VIEWS (Run periodically)
-- ============================================================================

-- Refresh user stats (every 5 minutes)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY user_trading_stats;

-- Refresh symbol stats (every 1 minute)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY symbol_trading_stats;

-- Refresh daily summary (every hour)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY daily_trading_summary;

-- ============================================================================
-- QUERY OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Function to get user's active positions efficiently
CREATE OR REPLACE FUNCTION get_user_active_positions(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    symbol VARCHAR,
    quantity DECIMAL,
    entry_price DECIMAL,
    current_price DECIMAL,
    unrealized_pnl DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.symbol,
        p.quantity,
        p.entry_price,
        md.price as current_price,
        (md.price - p.entry_price) * p.quantity as unrealized_pnl
    FROM positions p
    INNER JOIN LATERAL (
        SELECT price
        FROM market_data
        WHERE symbol = p.symbol
        ORDER BY timestamp DESC
        LIMIT 1
    ) md ON true
    WHERE p.user_id = p_user_id
    AND p.status = 'open';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get user's recent trades efficiently
CREATE OR REPLACE FUNCTION get_user_recent_trades(p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE (
    id UUID,
    symbol VARCHAR,
    type VARCHAR,
    quantity DECIMAL,
    price DECIMAL,
    status VARCHAR,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.symbol,
        t.type,
        t.quantity,
        t.price,
        t.status,
        t.created_at
    FROM trades t
    WHERE t.user_id = p_user_id
    ORDER BY t.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- VACUUM AND ANALYZE
-- ============================================================================

-- Analyze all tables to update statistics
ANALYZE users;
ANALYZE sessions;
ANALYZE trades;
ANALYZE positions;
ANALYZE orders;
ANALYZE market_data;
ANALYZE audit_logs;

-- ============================================================================
-- CONNECTION POOL OPTIMIZATION
-- ============================================================================

-- Recommended PostgreSQL configuration (postgresql.conf)
-- max_connections = 100
-- shared_buffers = 256MB
-- effective_cache_size = 1GB
-- maintenance_work_mem = 64MB
-- checkpoint_completion_target = 0.9
-- wal_buffers = 16MB
-- default_statistics_target = 100
-- random_page_cost = 1.1
-- effective_io_concurrency = 200
-- work_mem = 4MB
-- min_wal_size = 1GB
-- max_wal_size = 4GB

-- ============================================================================
-- MONITORING QUERIES
-- ============================================================================

-- Check index usage
-- SELECT
--     schemaname,
--     tablename,
--     indexname,
--     idx_scan,
--     idx_tup_read,
--     idx_tup_fetch
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan ASC;

-- Check table sizes
-- SELECT
--     schemaname,
--     tablename,
--     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries
-- SELECT
--     query,
--     calls,
--     total_time,
--     mean_time,
--     max_time
-- FROM pg_stat_statements
-- ORDER BY mean_time DESC
-- LIMIT 20;
