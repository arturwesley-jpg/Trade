import type { CreateAlertRuleRequest } from "./types.js";

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number; // -100 to 100
  impact: "low" | "medium" | "high";
  publishedAt: string;
  keywords: string[];
}

export class NewsAlertBuilder {
  /**
   * Create alert for negative sentiment spike
   * Example: Negative news sentiment exceeds threshold
   */
  static negativeSentimentSpike(symbol?: string, threshold = -50, cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: `${symbol ? symbol + " " : ""}Negative sentiment spike`,
      description: `Alert when ${symbol ? symbol + " " : ""}news sentiment drops below ${threshold}`,
      type: "news",
      symbol,
      conditions: [
        {
          field: "sentiment",
          condition: "below",
          value: threshold
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for positive sentiment spike
   * Example: Positive news sentiment exceeds threshold
   */
  static positiveSentimentSpike(symbol?: string, threshold = 50, cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: `${symbol ? symbol + " " : ""}Positive sentiment spike`,
      description: `Alert when ${symbol ? symbol + " " : ""}news sentiment rises above ${threshold}`,
      type: "news",
      symbol,
      conditions: [
        {
          field: "sentiment",
          condition: "above",
          value: threshold
        }
      ],
      frequency: "15m",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for high-impact news
   * Example: Major news event detected
   */
  static highImpactNews(symbol?: string, cooldownMinutes = 30): CreateAlertRuleRequest {
    return {
      name: `${symbol ? symbol + " " : ""}High-impact news detected`,
      description: `Alert when high-impact ${symbol ? symbol + " " : ""}news is detected`,
      type: "news",
      symbol,
      conditions: [
        {
          field: "news.impact",
          condition: "equals",
          value: 3 // 1=low, 2=medium, 3=high
        }
      ],
      frequency: "real-time",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for sentiment reversal
   * Example: Sentiment changes from negative to positive
   */
  static sentimentReversal(symbol?: string, cooldownMinutes = 120): CreateAlertRuleRequest {
    return {
      name: `${symbol ? symbol + " " : ""}Sentiment reversal`,
      description: `Alert when ${symbol ? symbol + " " : ""}news sentiment reverses direction`,
      type: "news",
      symbol,
      conditions: [
        {
          field: "sentiment",
          condition: "changes_by",
          value: 40 // Minimum change to trigger
        }
      ],
      frequency: "1h",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for regulatory news
   * Example: Regulatory announcement detected
   */
  static regulatoryNews(cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: "Regulatory news detected",
      description: "Alert when regulatory or legal news is detected",
      type: "news",
      conditions: [
        {
          field: "news.category",
          condition: "equals",
          value: 1 // Regulatory category flag
        }
      ],
      frequency: "real-time",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for exchange news
   * Example: Major exchange announcement
   */
  static exchangeNews(cooldownMinutes = 60): CreateAlertRuleRequest {
    return {
      name: "Exchange news detected",
      description: "Alert when major exchange news is detected (listings, delistings, issues)",
      type: "news",
      conditions: [
        {
          field: "news.category",
          condition: "equals",
          value: 2 // Exchange category flag
        }
      ],
      frequency: "real-time",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for hack/security news
   * Example: Security incident detected
   */
  static securityNews(cooldownMinutes = 30): CreateAlertRuleRequest {
    return {
      name: "Security incident detected",
      description: "Alert when hack, exploit, or security incident is detected",
      type: "news",
      conditions: [
        {
          field: "news.category",
          condition: "equals",
          value: 3 // Security category flag
        }
      ],
      frequency: "real-time",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }

  /**
   * Create alert for adoption news
   * Example: Major adoption or partnership announcement
   */
  static adoptionNews(symbol?: string, cooldownMinutes = 120): CreateAlertRuleRequest {
    return {
      name: `${symbol ? symbol + " " : ""}Adoption news detected`,
      description: `Alert when ${symbol ? symbol + " " : ""}adoption or partnership news is detected`,
      type: "news",
      symbol,
      conditions: [
        {
          field: "news.category",
          condition: "equals",
          value: 4 // Adoption category flag
        }
      ],
      frequency: "real-time",
      cooldownMinutes,
      deliveryChannels: ["telegram", "in-app"]
    };
  }
}

/**
 * Calculate aggregate sentiment score from news items
 */
export function calculateNewsSentiment(newsItems: NewsItem[], hoursBack = 24): {
  score: number;
  trend: "improving" | "declining" | "stable";
  highImpactCount: number;
  positiveCount: number;
  negativeCount: number;
} {
  if (newsItems.length === 0) {
    return {
      score: 0,
      trend: "stable",
      highImpactCount: 0,
      positiveCount: 0,
      negativeCount: 0
    };
  }

  const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;
  const recentNews = newsItems.filter(
    item => new Date(item.publishedAt).getTime() > cutoffTime
  );

  if (recentNews.length === 0) {
    return {
      score: 0,
      trend: "stable",
      highImpactCount: 0,
      positiveCount: 0,
      negativeCount: 0
    };
  }

  // Weight by impact and recency
  let weightedSum = 0;
  let totalWeight = 0;
  let highImpactCount = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  const now = Date.now();

  for (const item of recentNews) {
    const age = now - new Date(item.publishedAt).getTime();
    const ageHours = age / (60 * 60 * 1000);

    // Decay weight over time (newer = more weight)
    const recencyWeight = Math.exp(-ageHours / 12); // Half-life of 12 hours

    // Impact weight
    const impactWeight = item.impact === "high" ? 3 : item.impact === "medium" ? 2 : 1;

    const weight = recencyWeight * impactWeight;
    weightedSum += item.sentimentScore * weight;
    totalWeight += weight;

    if (item.impact === "high") highImpactCount++;
    if (item.sentimentScore > 20) positiveCount++;
    if (item.sentimentScore < -20) negativeCount++;
  }

  const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Calculate trend by comparing recent vs older news
  const midpoint = Math.floor(recentNews.length / 2);
  const recentHalf = recentNews.slice(0, midpoint);
  const olderHalf = recentNews.slice(midpoint);

  const recentAvg = recentHalf.reduce((sum, item) => sum + item.sentimentScore, 0) / recentHalf.length;
  const olderAvg = olderHalf.reduce((sum, item) => sum + item.sentimentScore, 0) / olderHalf.length;

  let trend: "improving" | "declining" | "stable" = "stable";
  if (recentAvg - olderAvg > 10) trend = "improving";
  else if (olderAvg - recentAvg > 10) trend = "declining";

  return {
    score: Math.round(score),
    trend,
    highImpactCount,
    positiveCount,
    negativeCount
  };
}

/**
 * Detect news keywords that might impact price
 */
export function detectImpactKeywords(newsItems: NewsItem[]): {
  keyword: string;
  count: number;
  sentiment: number;
}[] {
  const impactKeywords = [
    "regulation", "ban", "sec", "lawsuit", "hack", "exploit",
    "partnership", "adoption", "etf", "institutional", "listing",
    "delisting", "upgrade", "fork", "halving", "fed", "interest"
  ];

  const keywordStats = new Map<string, { count: number; totalSentiment: number }>();

  for (const item of newsItems) {
    const titleLower = item.title.toLowerCase();
    for (const keyword of impactKeywords) {
      if (titleLower.includes(keyword) || item.keywords.includes(keyword)) {
        const stats = keywordStats.get(keyword) || { count: 0, totalSentiment: 0 };
        stats.count++;
        stats.totalSentiment += item.sentimentScore;
        keywordStats.set(keyword, stats);
      }
    }
  }

  return Array.from(keywordStats.entries())
    .map(([keyword, stats]) => ({
      keyword,
      count: stats.count,
      sentiment: Math.round(stats.totalSentiment / stats.count)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
