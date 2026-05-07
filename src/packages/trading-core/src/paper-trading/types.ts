/**
 * Paper Trading Enhanced Types
 * Comprehensive types for advanced paper trading with automated TP/SL
 */

export interface PaperPosition {
  id: string;
  userId: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  marginUsdt: number;
  notional: number;
  unrealizedPnL: number;
  realizedPnL: number;
  takeProfit?: number[];
  stopLoss?: number;
  trailingStop?: {
    distance: number;
    activated: boolean;
    highestPrice?: number;
    lowestPrice?: number;
  };
  status: 'OPEN' | 'CLOSED';
  openedAt: number;
  closedAt?: number;
  fees: {
    entry: number;
    exit?: number;
    total: number;
  };
}

export interface TradeHistory {
  id: string;
  positionId: string;
  userId: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  leverage: number;
  pnl: number;
  pnlPercentage: number;
  fees: number;
  duration: number;
  openedAt: number;
  closedAt: number;
  closeReason: 'MANUAL' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'LIQUIDATION';
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercentage: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  averageRiskReward: number;
  averageTradeDuration: number;
  dailyMetrics?: DailyMetrics[];
  weeklyMetrics?: WeeklyMetrics[];
  monthlyMetrics?: MonthlyMetrics[];
}

export interface DailyMetrics {
  date: string;
  trades: number;
  pnl: number;
  winRate: number;
}

export interface WeeklyMetrics {
  week: string;
  trades: number;
  pnl: number;
  winRate: number;
}

export interface MonthlyMetrics {
  month: string;
  trades: number;
  pnl: number;
  winRate: number;
}

export interface OpenPositionRequest {
  userId: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  quantity: number;
  leverage?: number;
  marginUsdt: number;
  takeProfit?: number[];
  stopLoss?: number;
  trailingStop?: {
    distance: number;
  };
}

export interface UpdatePositionRequest {
  takeProfit?: number[];
  stopLoss?: number;
  trailingStop?: {
    distance: number;
  };
}

export interface ClosePositionRequest {
  exitPrice: number;
  reason?: 'MANUAL' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP';
}

export interface PositionCloseEvent {
  positionId: string;
  userId: string;
  symbol: string;
  exitPrice: number;
  pnl: number;
  reason: 'MANUAL' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'TRAILING_STOP' | 'LIQUIDATION';
  timestamp: number;
}

export interface PaperTradingConfig {
  makerFeePct: number;
  takerFeePct: number;
  slippagePct: number;
  monitorIntervalMs: number;
  enableAutoClose: boolean;
}
