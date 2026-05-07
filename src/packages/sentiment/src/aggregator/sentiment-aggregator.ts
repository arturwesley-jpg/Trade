/**
 * Sentiment Aggregator
 *
 * Combines sentiment signals from multiple sources:
 * - News sentiment (CryptoPanic)
 * - Fear & Greed Index
 * - Social media sentiment
 * - Whale activity
 *
 * Produces a unified sentiment score with confidence rating.
 */

import type {
  AggregatedSentiment,
  NewsArticle,
  FearGreedIndex,
  SocialSentiment,
  WhaleActivity,
  SentimentScore,
} from '../types';

export interface SentimentAggregatorConfig {
  weights?: {
    news?: number;
    fearGreed?: number;
    social?: number;
    whales?: number;
  };
  minConfidence?: number;
}

export class SentimentAggregator {
  private weights: Required<NonNullable<SentimentAggregatorConfig['weights']>>;
  private minConfidence: number;

  constructor(config: SentimentAggregatorConfig = {}) {
    this.weights = {
      news: config.weights?.news ?? 1.2,
      fearGreed: config.weights?.fearGreed ?? 1.5,
      social: config.weights?.social ?? 1.0,
      whales: config.weights?.whales ?? 1.3,
    };
    this.minConfidence = config.minConfidence ?? 50;
  }

  /**
   * Aggregate sentiment from all sources
   */
  aggregate(data: {
    symbol: string;
    news?: NewsArticle[];
    fearGreed?: FearGreedIndex;
    social?: SocialSentiment[];
    whales?: WhaleActivity[];
  }): AggregatedSentiment {
    const newsScore = this.aggregateNews(data.news || []);
    const fearGreedScore = this.aggregateFearGreed(data.fearGreed);
    const socialScore = this.aggregateSocial(data.social || []);
    const whalesScore = this.aggregateWhales(data.whales || []);

    // Calculate weighted average
    let totalWeightedScore = 0;
    let totalWeight = 0;

    if (newsScore.count > 0) {
      totalWeightedScore += newsScore.score * this.weights.news;
      totalWeight += this.weights.news;
    }

    if (fearGreedScore !== null) {
      totalWeightedScore += fearGreedScore * this.weights.fearGreed;
      totalWeight += this.weights.fearGreed;
    }

    if (socialScore.volume > 0) {
      totalWeightedScore += socialScore.score * this.weights.social;
      totalWeight += this.weights.social;
    }

    if (whalesScore.activity > 0) {
      totalWeightedScore += whalesScore.score * this.weights.whales;
      totalWeight += this.weights.whales;
    }

    const overallScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
    const sentiment = this.scoreToSentiment(overallScore);
    const confidence = this.calculateConfidence({
      newsCount: newsScore.count,
      hasFearGreed: fearGreedScore !== null,
      socialVolume: socialScore.volume,
      whaleActivity: whalesScore.activity,
    });

    return {
      symbol: data.symbol,
      overallScore,
      sentiment,
      confidence,
      components: {
        news: {
          score: newsScore.score,
          count: newsScore.count,
          weight: this.weights.news,
        },
        fearGreed: {
          score: fearGreedScore ?? 0,
          weight: this.weights.fearGreed,
        },
        social: {
          score: socialScore.score,
          volume: socialScore.volume,
          weight: this.weights.social,
        },
        whales: {
          score: whalesScore.score,
          activity: whalesScore.activity,
          weight: this.weights.whales,
        },
      },
      timestamp: new Date(),
    };
  }

  /**
   * Aggregate news sentiment
   */
  private aggregateNews(articles: NewsArticle[]): { score: number; count: number } {
    if (articles.length === 0) {
      return { score: 0, count: 0 };
    }

    const scores = articles
      .filter(a => a.sentiment)
      .map(a => this.sentimentToScore(a.sentiment!));

    if (scores.length === 0) {
      return { score: 0, count: 0 };
    }

    // Weight recent articles more heavily
    const now = Date.now();
    const weightedScores = articles.map((article, i) => {
      const ageHours = (now - article.publishedAt.getTime()) / (1000 * 60 * 60);
      const timeWeight = Math.exp(-ageHours / 24); // Exponential decay over 24 hours
      return scores[i] * timeWeight;
    });

    const totalWeight = weightedScores.reduce((sum, _) => sum + 1, 0);
    const score = weightedScores.reduce((sum, s) => sum + s, 0) / totalWeight;

    return { score, count: articles.length };
  }

  /**
   * Aggregate Fear & Greed Index
   */
  private aggregateFearGreed(index?: FearGreedIndex): number | null {
    if (!index) {
      return null;
    }

    // Map 0-100 to -1 to 1
    return (index.value - 50) / 50;
  }

  /**
   * Aggregate social sentiment
   */
  private aggregateSocial(sentiments: SocialSentiment[]): { score: number; volume: number } {
    if (sentiments.length === 0) {
      return { score: 0, volume: 0 };
    }

    // Weight by engagement
    const totalEngagement = sentiments.reduce((sum, s) => sum + s.engagement, 0);

    if (totalEngagement === 0) {
      const avgScore = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;
      const totalVolume = sentiments.reduce((sum, s) => sum + s.volume, 0);
      return { score: avgScore, volume: totalVolume };
    }

    const weightedScore = sentiments.reduce((sum, s) => {
      const weight = s.engagement / totalEngagement;
      return sum + s.score * weight;
    }, 0);

    const totalVolume = sentiments.reduce((sum, s) => sum + s.volume, 0);

    return { score: weightedScore, volume: totalVolume };
  }

  /**
   * Aggregate whale activity
   */
  private aggregateWhales(activities: WhaleActivity[]): { score: number; activity: number } {
    if (activities.length === 0) {
      return { score: 0, activity: 0 };
    }

    // Recent activity (last 24 hours)
    const now = Date.now();
    const recentActivities = activities.filter(a => {
      const ageHours = (now - a.timestamp.getTime()) / (1000 * 60 * 60);
      return ageHours <= 24;
    });

    if (recentActivities.length === 0) {
      return { score: 0, activity: 0 };
    }

    // Score based on activity type
    const scores = recentActivities.map(a => {
      let baseScore = 0;

      switch (a.type) {
        case 'WHALE_ACCUMULATION':
        case 'EXCHANGE_OUTFLOW':
          baseScore = 0.5; // Bullish
          break;
        case 'WHALE_DISTRIBUTION':
        case 'EXCHANGE_INFLOW':
          baseScore = -0.5; // Bearish
          break;
        case 'LARGE_TRANSFER':
          baseScore = 0; // Neutral
          break;
      }

      // Weight by significance
      const significanceWeight = {
        LOW: 0.5,
        MEDIUM: 1.0,
        HIGH: 1.5,
        CRITICAL: 2.0,
      }[a.significance];

      return baseScore * significanceWeight;
    });

    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    return { score: avgScore, activity: recentActivities.length };
  }

  /**
   * Calculate confidence based on data availability
   */
  private calculateConfidence(data: {
    newsCount: number;
    hasFearGreed: boolean;
    socialVolume: number;
    whaleActivity: number;
  }): number {
    let confidence = 0;

    // News contribution (0-30)
    if (data.newsCount > 0) {
      confidence += Math.min(data.newsCount * 3, 30);
    }

    // Fear & Greed contribution (0-25)
    if (data.hasFearGreed) {
      confidence += 25;
    }

    // Social contribution (0-25)
    if (data.socialVolume > 0) {
      confidence += Math.min(data.socialVolume / 10, 25);
    }

    // Whale contribution (0-20)
    if (data.whaleActivity > 0) {
      confidence += Math.min(data.whaleActivity * 5, 20);
    }

    return Math.min(confidence, 100);
  }

  /**
   * Convert sentiment enum to numeric score
   */
  private sentimentToScore(sentiment: SentimentScore): number {
    const map: Record<SentimentScore, number> = {
      VERY_BEARISH: -1,
      BEARISH: -0.5,
      NEUTRAL: 0,
      BULLISH: 0.5,
      VERY_BULLISH: 1,
    };
    return map[sentiment];
  }

  /**
   * Convert numeric score to sentiment enum
   */
  private scoreToSentiment(score: number): SentimentScore {
    if (score <= -0.6) return 'VERY_BEARISH';
    if (score <= -0.2) return 'BEARISH';
    if (score <= 0.2) return 'NEUTRAL';
    if (score <= 0.6) return 'BULLISH';
    return 'VERY_BULLISH';
  }
}
