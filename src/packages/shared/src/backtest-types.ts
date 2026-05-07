// Backtest persistence types

export interface Backtest {
  id: string;
  userId: string;
  name: string;
  description?: string;
  symbol: string;
  startDate: string;
  endDate: string;
  interval: string;
  initialCapital: number;
  feeRate: number;
  slippageRate: number;
  strategyName: string;
  strategyDescription?: string;
  strategyParameters: Record<string, any>;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface BacktestMetricsRecord {
  backtestId: string;
  totalReturn: number;
  totalReturnPct: number;
  sharpeRatio?: number;
  sortinoRatio?: number;
  calmarRatio?: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  winRate: number;
  profitFactor?: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin?: number;
  averageLoss?: number;
  largestWin?: number;
  largestLoss?: number;
  averageTradeDurationHours?: number;
  expectancy?: number;
  var95?: number;
  cvar95?: number;
  ulcerIndex?: number;
  recoveryFactor?: number;
  payoffRatio?: number;
  riskRewardRatio?: number;
  kellyCriterion?: number;
  createdAt: string;
}

export interface BacktestTrade {
  id: string;
  backtestId: string;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPct: number;
  openedAt: string;
  closedAt: string;
  durationHours: number;
  entryReason?: string;
  exitReason?: string;
}

export interface CreateBacktestRequest {
  name: string;
  description?: string;
  symbol: string;
  startDate: string;
  endDate: string;
  interval: string;
  initialCapital: number;
  feeRate: number;
  slippageRate: number;
  strategyName: string;
  strategyDescription?: string;
  strategyParameters?: Record<string, any>;
}

export interface BacktestWithMetrics extends Backtest {
  metrics?: BacktestMetricsRecord;
}

export interface BacktestListResponse {
  backtests: BacktestWithMetrics[];
  total: number;
  page: number;
  pageSize: number;
}
