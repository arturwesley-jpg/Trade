/**
 * Sentiment Package Types
 *
 * Shared type definitions for the sentiment analysis system.
 */

/**
 * Standardized sentiment score levels
 */
export type SentimentScore =
  | 'VERY_BEARISH'
  | 'BEARISH'
  | 'NEUTRAL'
  | 'BULLISH'
  | 'VERY_BULLISH';

/**
 * News article with sentiment data
 */
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
    important?: number;
  };
}

/**
 * Fear & Greed Index data point
 */
export interface FearGreedIndex {
  value: number; // 0-100
  valueClassification: string; // e.g. "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  timestamp: Date;
  timeUntilUpdate?: string;
}

/**
 * Social media sentiment data
 */
export interface SocialSentiment {
  platform: string; // e.g. "twitter", "reddit"
  symbol: string;
  score: number; // -1 to 1
  volume: number; // total mentions/interactions
  engagement: number; // weighted engagement metric
  timestamp: Date;
}

/**
 * Whale activity event
 */
export interface WhaleActivity {
  symbol: string;
  type:
    | 'LARGE_TRANSFER'
    | 'EXCHANGE_INFLOW'
    | 'EXCHANGE_OUTFLOW'
    | 'WHALE_ACCUMULATION'
    | 'WHALE_DISTRIBUTION';
  amount: number;
  amountUSD: number;
  fromAddress?: string;
  toAddress?: string;
  txHash?: string;
  timestamp: Date;
  significance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Provider interface for sentiment data sources
 */
export interface SentimentProvider {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

/**
 * Aggregated sentiment result combining all sources
 */
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
