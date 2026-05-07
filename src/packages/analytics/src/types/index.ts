export type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';
export type TimeFrame = '1h' | '4h' | '1d' | '1w' | '1m' | '3m' | '1y' | 'all';
export type ChartType = 'line' | 'bar' | 'candlestick' | 'area' | 'pie' | 'heatmap';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface ChartData {
  type: ChartType;
  title: string;
  data: ChartDataPoint[] | Record<string, number>;
  xAxis?: string;
  yAxis?: string;
  colors?: string[];
}

export interface PortfolioMetrics {
  totalTrades: number;
  openPositions: number;
  closedPositions: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  totalReturnPct: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  currentDrawdown: number;
  avgHoldingTime: number; // in hours
  avgTradesPerDay: number;
  totalFees: number;
  netProfit: number;
  riskRewardRatio: number;
  expectancy: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  recoveryFactor: number;
}

export interface SignalMetrics {
  totalSignals: number;
  executedSignals: number;
  successfulSignals: number;
  failedSignals: number;
  accuracy: number;
  avgConfidence: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  avgTimeToExecution: number; // in minutes
  signalsByType: Record<string, number>;
  signalsByConfidence: {
    high: number;
    medium: number;
    low: number;
  };
  performanceByIndicator: Record<string, {
    total: number;
    successful: number;
    accuracy: number;
  }>;
  confidenceCorrelation: number; // correlation between confidence and success
}

export interface UserMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  churnedUsers: number;
  retentionRate: number;
  avgSessionDuration: number; // in minutes
  avgSessionsPerUser: number;
  featureUsage: Record<string, number>;
  usersByTier: Record<string, number>;
  engagementScore: number;
}

export interface CohortAnalysis {
  cohortDate: string;
  totalUsers: number;
  retention: Record<string, number>; // week/month -> retention rate
}

export interface MarketMetrics {
  avgVolatility: number;
  trendStrength: number;
  marketSentiment: number;
  dominantTrend: 'bullish' | 'bearish' | 'neutral';
  correlations: Record<string, Record<string, number>>; // symbol -> symbol -> correlation
  volumeProfile: {
    avgVolume: number;
    volumeTrend: 'increasing' | 'decreasing' | 'stable';
    volumeSpikes: number;
  };
  whaleActivity: {
    totalEvents: number;
    avgImpact: number;
    netFlow: number; // positive = accumulation, negative = distribution
  };
}

export interface Report {
  id: string;
  type: ReportType;
  userId?: string;
  period: DateRange;
  generatedAt: Date;
  metrics: {
    portfolio?: PortfolioMetrics;
    signals?: SignalMetrics;
    market?: MarketMetrics;
    user?: UserMetrics;
  };
  charts: ChartData[];
  insights: string[];
  recommendations: string[];
}

export interface AnalyticsQuery {
  userId?: string;
  symbols?: string[];
  period: DateRange;
  timeFrame?: TimeFrame;
  mode?: 'paper' | 'live' | 'all';
}

export interface DrawdownPeriod {
  start: Date;
  end: Date;
  peak: number;
  trough: number;
  drawdown: number;
  drawdownPct: number;
  recovery?: Date;
  duration: number; // in days
}

export interface PerformanceByAsset {
  symbol: string;
  trades: number;
  winRate: number;
  totalReturn: number;
  avgReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface TradingFrequency {
  daily: number;
  weekly: number;
  monthly: number;
  byHour: Record<number, number>; // hour of day -> trade count
  byDayOfWeek: Record<number, number>; // 0-6 -> trade count
}

export interface RiskMetrics {
  valueAtRisk: number; // VaR at 95% confidence
  conditionalVaR: number; // CVaR/Expected Shortfall
  beta: number;
  alpha: number;
  informationRatio: number;
  calmarRatio: number;
  sterlingRatio: number;
}
