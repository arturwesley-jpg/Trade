/**
 * Sentiment Dashboard Component
 * Displays market sentiment indicators including Fear & Greed, news sentiment, and social trends
 */

import { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";

interface SentimentData {
  fearGreedIndex: number;
  fearGreedLabel: string;
  newsSentiment: number;
  socialSentiment: number;
  whaleActivity: "high" | "medium" | "low";
}

interface NewsItem {
  id: string;
  title: string;
  sentiment: "positive" | "negative" | "neutral";
  timestamp: string;
  source: string;
}

interface WhaleTransaction {
  id: string;
  type: "buy" | "sell";
  amount: number;
  symbol: string;
  timestamp: string;
}

export const SentimentDashboard = memo(function SentimentDashboard() {
  const [sentiment, setSentiment] = useState<SentimentData>({
    fearGreedIndex: 65,
    fearGreedLabel: "Greed",
    newsSentiment: 0.42,
    socialSentiment: 0.58,
    whaleActivity: "medium"
  });

  const [news, setNews] = useState<NewsItem[]>([]);
  const [whaleTransactions, setWhaleTransactions] = useState<WhaleTransaction[]>([]);

  // Mock data for demonstration
  useEffect(() => {
    setNews([
      {
        id: "1",
        title: "Bitcoin reaches new all-time high",
        sentiment: "positive",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        source: "CoinDesk"
      },
      {
        id: "2",
        title: "Regulatory concerns in major markets",
        sentiment: "negative",
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        source: "Bloomberg"
      },
      {
        id: "3",
        title: "Institutional adoption continues to grow",
        sentiment: "positive",
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        source: "Reuters"
      }
    ]);

    setWhaleTransactions([
      {
        id: "1",
        type: "buy",
        amount: 1250.5,
        symbol: "BTC",
        timestamp: new Date(Date.now() - 1800000).toISOString()
      },
      {
        id: "2",
        type: "sell",
        amount: 850.2,
        symbol: "ETH",
        timestamp: new Date(Date.now() - 3600000).toISOString()
      }
    ]);
  }, []);

  const getFearGreedColor = (index: number) => {
    if (index < 25) return "#ef4444"; // Extreme Fear
    if (index < 45) return "#f59e0b"; // Fear
    if (index < 55) return "#94a3b8"; // Neutral
    if (index < 75) return "#22c55e"; // Greed
    return "#16a34a"; // Extreme Greed
  };

  const getFearGreedLabel = (index: number) => {
    if (index < 25) return "Extreme Fear";
    if (index < 45) return "Fear";
    if (index < 55) return "Neutral";
    if (index < 75) return "Greed";
    return "Extreme Greed";
  };

  const getSentimentColor = (sentiment: "positive" | "negative" | "neutral") => {
    switch (sentiment) {
      case "positive":
        return "var(--positive)";
      case "negative":
        return "var(--negative)";
      default:
        return "var(--muted)";
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="sentiment-dashboard">
      <div className="sentiment-grid">
        {/* Fear & Greed Index */}
        <motion.div
          className="sentiment-card fear-greed-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="card-header">
            <h3>Fear & Greed Index</h3>
          </div>

          <div className="fear-greed-gauge">
            <svg viewBox="0 0 200 120" className="gauge-svg">
              {/* Background arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="rgba(148, 163, 184, 0.2)"
                strokeWidth="20"
                strokeLinecap="round"
              />
              {/* Value arc */}
              <motion.path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke={getFearGreedColor(sentiment.fearGreedIndex)}
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray="251.2"
                initial={{ strokeDashoffset: 251.2 }}
                animate={{ strokeDashoffset: 251.2 - (sentiment.fearGreedIndex / 100) * 251.2 }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
              {/* Center text */}
              <text x="100" y="80" textAnchor="middle" className="gauge-value">
                {sentiment.fearGreedIndex}
              </text>
              <text x="100" y="100" textAnchor="middle" className="gauge-label">
                {getFearGreedLabel(sentiment.fearGreedIndex)}
              </text>
            </svg>
          </div>

          <div className="sentiment-metrics">
            <div className="metric">
              <span className="metric-label">News Sentiment</span>
              <div className="sentiment-bar">
                <motion.div
                  className="sentiment-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${sentiment.newsSentiment * 100}%` }}
                  transition={{ duration: 0.8 }}
                  style={{ backgroundColor: sentiment.newsSentiment > 0.5 ? "var(--positive)" : "var(--negative)" }}
                />
              </div>
              <span className="metric-value">{(sentiment.newsSentiment * 100).toFixed(0)}%</span>
            </div>

            <div className="metric">
              <span className="metric-label">Social Sentiment</span>
              <div className="sentiment-bar">
                <motion.div
                  className="sentiment-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${sentiment.socialSentiment * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                  style={{ backgroundColor: sentiment.socialSentiment > 0.5 ? "var(--positive)" : "var(--negative)" }}
                />
              </div>
              <span className="metric-value">{(sentiment.socialSentiment * 100).toFixed(0)}%</span>
            </div>
          </div>
        </motion.div>

        {/* News Sentiment Timeline */}
        <motion.div
          className="sentiment-card news-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="card-header">
            <h3>News Sentiment</h3>
          </div>

          <div className="news-timeline">
            {news.map((item, index) => (
              <motion.div
                key={item.id}
                className="news-item"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <div
                  className="news-indicator"
                  style={{ backgroundColor: getSentimentColor(item.sentiment) }}
                />
                <div className="news-content">
                  <div className="news-title">{item.title}</div>
                  <div className="news-meta">
                    <span className="news-source">{item.source}</span>
                    <span className="news-time">{formatTimeAgo(item.timestamp)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Whale Activity Feed */}
        <motion.div
          className="sentiment-card whale-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="card-header">
            <h3>Whale Activity</h3>
            <span className={`activity-badge ${sentiment.whaleActivity}`}>
              {sentiment.whaleActivity}
            </span>
          </div>

          <div className="whale-feed">
            {whaleTransactions.map((tx, index) => (
              <motion.div
                key={tx.id}
                className="whale-transaction"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <div className={`tx-type ${tx.type}`}>
                  {tx.type === "buy" ? "↑" : "↓"}
                </div>
                <div className="tx-details">
                  <div className="tx-amount">
                    {tx.amount.toLocaleString()} {tx.symbol}
                  </div>
                  <div className="tx-time">{formatTimeAgo(tx.timestamp)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
});
