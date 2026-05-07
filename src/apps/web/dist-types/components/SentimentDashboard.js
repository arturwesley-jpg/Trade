import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Sentiment Dashboard Component
 * Displays market sentiment indicators including Fear & Greed, news sentiment, and social trends
 */
import { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";
export const SentimentDashboard = memo(function SentimentDashboard() {
    const [sentiment, setSentiment] = useState({
        fearGreedIndex: 65,
        fearGreedLabel: "Greed",
        newsSentiment: 0.42,
        socialSentiment: 0.58,
        whaleActivity: "medium"
    });
    const [news, setNews] = useState([]);
    const [whaleTransactions, setWhaleTransactions] = useState([]);
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
    const getFearGreedColor = (index) => {
        if (index < 25)
            return "#ef4444"; // Extreme Fear
        if (index < 45)
            return "#f59e0b"; // Fear
        if (index < 55)
            return "#94a3b8"; // Neutral
        if (index < 75)
            return "#22c55e"; // Greed
        return "#16a34a"; // Extreme Greed
    };
    const getFearGreedLabel = (index) => {
        if (index < 25)
            return "Extreme Fear";
        if (index < 45)
            return "Fear";
        if (index < 55)
            return "Neutral";
        if (index < 75)
            return "Greed";
        return "Extreme Greed";
    };
    const getSentimentColor = (sentiment) => {
        switch (sentiment) {
            case "positive":
                return "var(--positive)";
            case "negative":
                return "var(--negative)";
            default:
                return "var(--muted)";
        }
    };
    const formatTimeAgo = (timestamp) => {
        const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
        if (seconds < 60)
            return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60)
            return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };
    return (_jsx("div", { className: "sentiment-dashboard", children: _jsxs("div", { className: "sentiment-grid", children: [_jsxs(motion.div, { className: "sentiment-card fear-greed-card", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 }, children: [_jsx("div", { className: "card-header", children: _jsx("h3", { children: "Fear & Greed Index" }) }), _jsx("div", { className: "fear-greed-gauge", children: _jsxs("svg", { viewBox: "0 0 200 120", className: "gauge-svg", children: [_jsx("path", { d: "M 20 100 A 80 80 0 0 1 180 100", fill: "none", stroke: "rgba(148, 163, 184, 0.2)", strokeWidth: "20", strokeLinecap: "round" }), _jsx(motion.path, { d: "M 20 100 A 80 80 0 0 1 180 100", fill: "none", stroke: getFearGreedColor(sentiment.fearGreedIndex), strokeWidth: "20", strokeLinecap: "round", strokeDasharray: "251.2", initial: { strokeDashoffset: 251.2 }, animate: { strokeDashoffset: 251.2 - (sentiment.fearGreedIndex / 100) * 251.2 }, transition: { duration: 1, ease: "easeOut" } }), _jsx("text", { x: "100", y: "80", textAnchor: "middle", className: "gauge-value", children: sentiment.fearGreedIndex }), _jsx("text", { x: "100", y: "100", textAnchor: "middle", className: "gauge-label", children: getFearGreedLabel(sentiment.fearGreedIndex) })] }) }), _jsxs("div", { className: "sentiment-metrics", children: [_jsxs("div", { className: "metric", children: [_jsx("span", { className: "metric-label", children: "News Sentiment" }), _jsx("div", { className: "sentiment-bar", children: _jsx(motion.div, { className: "sentiment-fill", initial: { width: 0 }, animate: { width: `${sentiment.newsSentiment * 100}%` }, transition: { duration: 0.8 }, style: { backgroundColor: sentiment.newsSentiment > 0.5 ? "var(--positive)" : "var(--negative)" } }) }), _jsxs("span", { className: "metric-value", children: [(sentiment.newsSentiment * 100).toFixed(0), "%"] })] }), _jsxs("div", { className: "metric", children: [_jsx("span", { className: "metric-label", children: "Social Sentiment" }), _jsx("div", { className: "sentiment-bar", children: _jsx(motion.div, { className: "sentiment-fill", initial: { width: 0 }, animate: { width: `${sentiment.socialSentiment * 100}%` }, transition: { duration: 0.8, delay: 0.1 }, style: { backgroundColor: sentiment.socialSentiment > 0.5 ? "var(--positive)" : "var(--negative)" } }) }), _jsxs("span", { className: "metric-value", children: [(sentiment.socialSentiment * 100).toFixed(0), "%"] })] })] })] }), _jsxs(motion.div, { className: "sentiment-card news-card", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: 0.1 }, children: [_jsx("div", { className: "card-header", children: _jsx("h3", { children: "News Sentiment" }) }), _jsx("div", { className: "news-timeline", children: news.map((item, index) => (_jsxs(motion.div, { className: "news-item", initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.3, delay: index * 0.1 }, children: [_jsx("div", { className: "news-indicator", style: { backgroundColor: getSentimentColor(item.sentiment) } }), _jsxs("div", { className: "news-content", children: [_jsx("div", { className: "news-title", children: item.title }), _jsxs("div", { className: "news-meta", children: [_jsx("span", { className: "news-source", children: item.source }), _jsx("span", { className: "news-time", children: formatTimeAgo(item.timestamp) })] })] })] }, item.id))) })] }), _jsxs(motion.div, { className: "sentiment-card whale-card", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: 0.2 }, children: [_jsxs("div", { className: "card-header", children: [_jsx("h3", { children: "Whale Activity" }), _jsx("span", { className: `activity-badge ${sentiment.whaleActivity}`, children: sentiment.whaleActivity })] }), _jsx("div", { className: "whale-feed", children: whaleTransactions.map((tx, index) => (_jsxs(motion.div, { className: "whale-transaction", initial: { opacity: 0, x: -20 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.3, delay: index * 0.1 }, children: [_jsx("div", { className: `tx-type ${tx.type}`, children: tx.type === "buy" ? "↑" : "↓" }), _jsxs("div", { className: "tx-details", children: [_jsxs("div", { className: "tx-amount", children: [tx.amount.toLocaleString(), " ", tx.symbol] }), _jsx("div", { className: "tx-time", children: formatTimeAgo(tx.timestamp) })] })] }, tx.id))) })] })] }) }));
});
