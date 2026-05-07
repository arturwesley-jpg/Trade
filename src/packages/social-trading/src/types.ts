/**
 * Social Trading Types
 * Core type definitions for social trading features
 */

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  openedAt: Date;
}

export interface PerformanceData {
  timestamp: Date;
  portfolioValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  dailyReturn?: number;
  dailyReturnPercent?: number;
}

export interface TraderStats {
  totalReturn: number;
  totalReturnPercent: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  followers: number;
  copiers: number;
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  averageHoldTime: number; // in hours
  riskScore: number; // 0-100
  consistencyScore: number; // 0-100
}

export type VisibilityLevel = 'public' | 'followers' | 'private';

export interface TraderProfile {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  verified: boolean;
  stats: TraderStats;
  portfolio: {
    positions: Position[];
    performance: PerformanceData[];
    totalValue: number;
  };
  visibility: VisibilityLevel;
  allowCopying: boolean;
  minCopyAmount?: number;
  maxCopiers?: number;
  tradingStyle?: string[];
  preferredMarkets?: string[];
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  joinedAt: Date;
  lastActiveAt: Date;
}

export interface CopySettings {
  copyTradeId: string;
  followerId: string;
  traderId: string;
  enabled: boolean;
  copyPercentage: number; // 1-100, percentage of trader's position size
  maxAmountPerTrade?: number;
  maxTotalExposure?: number;
  copyStopLoss: boolean;
  copyTakeProfit: boolean;
  stopCopyConditions: {
    maxDrawdown?: number; // percentage
    minWinRate?: number; // percentage
    consecutiveLosses?: number;
  };
  allowedSymbols?: string[]; // if empty, copy all
  excludedSymbols?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CopyTradeExecution {
  id: string;
  copyTradeId: string;
  originalTradeId: string;
  followerId: string;
  traderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  status: 'pending' | 'executed' | 'failed' | 'skipped';
  reason?: string;
  executedAt?: Date;
  createdAt: Date;
}

export interface FollowRelationship {
  id: string;
  followerId: string;
  traderId: string;
  notifications: {
    newTrade: boolean;
    newPost: boolean;
    performanceAlert: boolean;
  };
  createdAt: Date;
}

export interface TradePost {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  verified: boolean;
  type: 'trade_idea' | 'analysis' | 'update' | 'question';
  content: string;
  symbol?: string;
  side?: 'long' | 'short';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  timeframe?: string;
  tags?: string[];
  attachments?: {
    type: 'image' | 'chart';
    url: string;
  }[];
  reactions: {
    likes: number;
    bullish: number;
    bearish: number;
  };
  commentCount: number;
  shareCount: number;
  visibility: VisibilityLevel;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  verified: boolean;
  content: string;
  parentCommentId?: string;
  reactions: {
    likes: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  verified: boolean;
  score: number;
  stats: {
    totalReturn: number;
    totalReturnPercent: number;
    winRate: number;
    sharpeRatio: number;
    followers: number;
    copiers: number;
    totalTrades: number;
  };
  badges?: string[];
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
}

export interface LeaderboardFilters {
  timeframe: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';
  strategyType?: string[];
  riskLevel?: ('conservative' | 'moderate' | 'aggressive')[];
  minTrades?: number;
  minFollowers?: number;
  markets?: string[];
}

export interface ChatRoom {
  id: string;
  name: string;
  description: string;
  type: 'public' | 'private' | 'trading_group';
  symbol?: string; // for symbol-specific rooms
  memberCount: number;
  createdBy: string;
  moderators: string[];
  rules?: string[];
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  verified: boolean;
  content: string;
  type: 'text' | 'trade_alert' | 'system';
  metadata?: {
    tradeId?: string;
    symbol?: string;
    price?: number;
  };
  reactions?: Record<string, number>;
  createdAt: Date;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

export interface ActivityFeedItem {
  id: string;
  type: 'trade' | 'post' | 'follow' | 'copy_start' | 'achievement';
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  verified: boolean;
  data: {
    tradeId?: string;
    postId?: string;
    symbol?: string;
    side?: 'buy' | 'sell';
    pnl?: number;
    pnlPercent?: number;
    followedUserId?: string;
    followedUsername?: string;
    achievement?: string;
  };
  createdAt: Date;
}

export interface SentimentPoll {
  id: string;
  symbol: string;
  question: string;
  options: {
    id: string;
    text: string;
    votes: number;
  }[];
  totalVotes: number;
  userVote?: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface TradeAlert {
  id: string;
  traderId: string;
  traderUsername: string;
  traderDisplayName: string;
  type: 'entry' | 'exit' | 'update';
  symbol: string;
  side: 'long' | 'short';
  price: number;
  quantity?: number;
  reason?: string;
  createdAt: Date;
}

export interface RiskWarning {
  type: 'high_risk_trader' | 'high_drawdown' | 'volatile_strategy' | 'new_trader' | 'max_exposure';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details?: Record<string, any>;
}

export interface CopyTradingPerformance {
  copyTradeId: string;
  traderId: string;
  traderUsername: string;
  startDate: Date;
  totalCopiedTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalFees: number;
  averageSlippage: number;
  correlationWithTrader: number; // 0-1
}
