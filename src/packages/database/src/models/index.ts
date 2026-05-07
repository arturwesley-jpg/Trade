export interface MarketTick {
  id: string;
  symbol: string;
  price: string;
  volume: string;
  timestamp: Date;
  provider: string;
  qualityScore?: number;
}

export interface OHLCVCandle {
  id: string;
  symbol: string;
  interval: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  timestamp: Date;
}

export interface Signal {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  score: number;
  rationale: Record<string, any>;
  indicators: Record<string, any>;
  sentimentScore?: number;
  whaleImpact?: number;
  shouldExecute: boolean;
  timestamp: Date;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: string;
  currentPrice: string;
  quantity: string;
  leverage: number;
  stopLoss?: string;
  takeProfit?: string;
  unrealizedPnl: string;
  realizedPnl: string;
  status: 'OPEN' | 'CLOSED';
  mode: 'PAPER' | 'LIVE';
  openedAt: Date;
  closedAt?: Date;
}

export interface Trade {
  id: string;
  positionId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: string;
  quantity: string;
  fee: string;
  pnl?: string;
  mode: 'PAPER' | 'LIVE';
  timestamp: Date;
}

export interface Alert {
  id: string;
  ruleId: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  data?: Record<string, any>;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  type: string;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WhaleEvent {
  id: string;
  eventType: string;
  symbol: string;
  amount: string;
  usdValue?: string;
  source?: string;
  destination?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: Date;
}

export interface NewsEvent {
  id: string;
  title: string;
  content: string;
  source: string;
  url?: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  sentimentScore: number;
  symbols: string[];
  publishedAt: Date;
  createdAt: Date;
}

export interface SentimentSnapshot {
  id: string;
  symbol: string;
  source: string;
  score: number;
  volume: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  timestamp: Date;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
