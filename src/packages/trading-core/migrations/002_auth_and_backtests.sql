-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Refresh tokens for JWT authentication
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Backtests table for persisting backtest results
CREATE TABLE IF NOT EXISTS backtests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  symbol TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  interval TEXT NOT NULL,
  initial_capital NUMERIC NOT NULL,
  fee_rate NUMERIC NOT NULL,
  slippage_rate NUMERIC NOT NULL,
  strategy_name TEXT NOT NULL,
  strategy_description TEXT,
  strategy_parameters JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_backtests_user_id ON backtests(user_id);
CREATE INDEX IF NOT EXISTS idx_backtests_status ON backtests(status);
CREATE INDEX IF NOT EXISTS idx_backtests_created_at ON backtests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backtests_symbol ON backtests(symbol);

-- Backtest metrics table for storing detailed results
CREATE TABLE IF NOT EXISTS backtest_metrics (
  backtest_id TEXT PRIMARY KEY REFERENCES backtests(id) ON DELETE CASCADE,
  total_return NUMERIC NOT NULL,
  total_return_pct NUMERIC NOT NULL,
  sharpe_ratio NUMERIC,
  sortino_ratio NUMERIC,
  calmar_ratio NUMERIC,
  max_drawdown NUMERIC NOT NULL,
  max_drawdown_pct NUMERIC NOT NULL,
  win_rate NUMERIC NOT NULL,
  profit_factor NUMERIC,
  total_trades INTEGER NOT NULL,
  winning_trades INTEGER NOT NULL,
  losing_trades INTEGER NOT NULL,
  average_win NUMERIC,
  average_loss NUMERIC,
  largest_win NUMERIC,
  largest_loss NUMERIC,
  average_trade_duration_hours NUMERIC,
  expectancy NUMERIC,
  var_95 NUMERIC,
  cvar_95 NUMERIC,
  ulcer_index NUMERIC,
  recovery_factor NUMERIC,
  payoff_ratio NUMERIC,
  risk_reward_ratio NUMERIC,
  kelly_criterion NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backtest trades table for storing individual trades from backtests
CREATE TABLE IF NOT EXISTS backtest_trades (
  id TEXT PRIMARY KEY,
  backtest_id TEXT NOT NULL REFERENCES backtests(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  pnl NUMERIC NOT NULL,
  pnl_pct NUMERIC NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL,
  duration_hours NUMERIC NOT NULL,
  entry_reason TEXT,
  exit_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_backtest_trades_backtest_id ON backtest_trades(backtest_id);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_opened_at ON backtest_trades(opened_at);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_symbol TEXT DEFAULT 'BTC-USDT',
  default_interval TEXT DEFAULT '1h',
  default_initial_capital NUMERIC DEFAULT 10000,
  theme TEXT DEFAULT 'dark',
  notifications_enabled BOOLEAN DEFAULT true,
  email_alerts BOOLEAN DEFAULT false,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
