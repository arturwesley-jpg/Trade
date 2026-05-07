/**
 * Sentiment Analysis Types
 */

export type SentimentScore = 'VERY_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'VERY_BULLISH';

export interface NewsArticle {
  id: string;
  title: string;
  body?: string;
  url: string;
  source: string;
  publishedAt: Date;
  sentiment?: SentimentScore;
  currencies?: string[];
  votes?: {
    positive: number;
    negative: number;
    important: number;
  };
}

export interface FearGreedIndex {
  value: number; // 0-100
  classification: 'EXTREME_FEAR' | 'FEAR' | 'NEUTRAL' | 'GREED' | 'EXTREME_GREED';
  timestamp: Date;
  components?: {
    volatility?: number;
    marketMomentum?: number;
    socialMedia?: number;
    surveys?: number;
    dominance?: number;
    trends?: number;
  };
}

export interface SocialSentiment {
  platform: 'TWITTER' | 'REDDIT' | 'TELEGRAM';
  symbol: string;
  sentiment: SentimentScore;
  score: number; // -1 to 1
  volume: number; // Number of mentions
  engagement: number; // Likes, retweets, comments
  timestamp: Date;
  topPosts?: {
    text: string;
    author: string;
    engagement: number;
    sentiment: SentimentScore;
  }[];
}

export interface WhaleActivity {
  symbol: string;
  type: 'LARGE_TRANSFER' | 'EXCHANGE_INFLOW' | 'EXCHANGE_OUTFLOW' | 'WHALE_ACCUMULATION' | 'WHALE_DISTRIBUTION';
  amount: number;
  amountUSD: number;
  fromAddress?: string;
  toAddress?: string;
  txHash: string;
  timestamp: Date;
  significance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface AggregatedSentiment {
  symbol: string;
  overallScore: number; // -1 to 1
  sentiment: SentimentScore;
  confidence: number; // 0-100
  components: {
    news: {
      score: number;
      count: number;
      weight: number;
    };
    fearGreed: {
      score: number;
      weight: number;
    };
    social: {
      score: number;
      volume: number;
      weight: number;
    };
    whales: {
      score: number;
      activity: number;
      weight: number;
    };
  };
  timestamp: Date;
}

export interface SentimentProvider {
  name: string;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
