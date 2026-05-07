# Whale Tracking System

## Overview

The whale tracking system monitors large cryptocurrency transactions and wallet movements to provide insights into market sentiment and potential price movements.

## Features

### 1. Data Sources Integration
- **Whale Alert API**: Real-time whale transaction monitoring
- **Blockchain Explorers**: Etherscan and BscScan for on-chain data
- **Exchange Flow Monitoring**: Track inflows/outflows to exchanges

### 2. Whale Event Detection
- Large transfers (> $100k USD by default, configurable)
- Exchange inflows (potential selling pressure)
- Exchange outflows (potential accumulation)
- Accumulation patterns (multiple buys over time)
- Distribution patterns (multiple sells over time)
- Stablecoin flows (buying power indicators)

### 3. Analysis Features
- **Wallet Classification**: Identify exchanges, whales, and smart money
- **Historical Pattern Analysis**: Detect accumulation/distribution trends
- **Correlation Analysis**: Link whale activity to price movements
- **Sentiment Scoring**: Generate bullish/bearish signals from whale behavior

### 4. Database Integration
- Store whale events with full metadata
- Track wallet addresses and their activity history
- Query events by symbol, severity, time range

## API Endpoints

### GET /api/whale/events
Get recent whale events with optional filtering.

**Query Parameters:**
- `symbol` (optional): Filter by cryptocurrency symbol
- `severity` (optional): Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
- `limit` (optional): Max results (default: 50, max: 200)
- `startDate` (optional): ISO datetime string
- `endDate` (optional): ISO datetime string

**Example:**
```bash
curl "http://localhost:3000/api/whale/events?symbol=BTC&severity=HIGH&limit=20"
```

### GET /api/whale/wallets/:address
Get wallet activity and classification.

**Query Parameters:**
- `blockchain` (optional): ethereum or bsc (default: ethereum)
- `limit` (optional): Max transactions (default: 100, max: 200)

**Example:**
```bash
curl "http://localhost:3000/api/whale/wallets/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb?blockchain=ethereum"
```

### GET /api/whale/analysis/:symbol
Get comprehensive whale analysis for a symbol.

**Query Parameters:**
- `timeWindow` (optional): Hours to analyze (default: 24, max: 168)

**Example:**
```bash
curl "http://localhost:3000/api/whale/analysis/BTC?timeWindow=48"
```

**Response:**
```json
{
  "data": {
    "symbol": "BTC",
    "analysis": {
      "score": 0.65,
      "significance": "HIGH",
      "summary": "Strong accumulation detected: 15 whale buys, $45.2M total volume"
    },
    "exchangeFlow": {
      "totalInflow": 12500000,
      "totalOutflow": 32700000,
      "netFlow": 20200000,
      "inflowCount": 8,
      "outflowCount": 15,
      "sentiment": "BULLISH"
    },
    "recentActivity": [],
    "recentEvents": [],
    "timeWindow": 48
  }
}
```

### GET /api/whale/accumulation
Detect accumulation patterns for a specific wallet and symbol.

**Query Parameters:**
- `address` (required): Wallet address
- `symbol` (required): Cryptocurrency symbol
- `timeWindow` (optional): Hours to analyze (default: 24, max: 168)

### GET /api/whale/distribution
Detect distribution patterns for a specific wallet and symbol.

### GET /api/whale/exchange-flow/:symbol
Get exchange flow analysis for a symbol.

### GET /api/whale/stablecoin-flows
Get stablecoin flow analysis (USDT, USDC, BUSD, DAI).

## Configuration

### Environment Variables

```bash
# Whale Alert API (free tier available at https://whale-alert.io/)
WHALE_ALERT_API_KEY=your_whale_alert_api_key

# Blockchain Explorers
ETHERSCAN_API_KEY=your_etherscan_api_key
BSCSCAN_API_KEY=your_bscscan_api_key
```

### Programmatic Configuration

```typescript
import { WhaleTracker } from '@trading-bot/sentiment';

const whaleTracker = new WhaleTracker({
  minTransactionUSD: 100000,
  significanceThresholds: {
    low: 100000,
    medium: 500000,
    high: 1000000,
    critical: 5000000
  },
  whaleAlertApiKey: process.env.WHALE_ALERT_API_KEY,
  etherscanApiKey: process.env.ETHERSCAN_API_KEY,
  bscscanApiKey: process.env.BSCSCAN_API_KEY,
  enableCaching: true,
  cacheTTL: 300
});
```

## Usage Examples

See `packages/sentiment/src/examples/whale-tracking-example.ts` for comprehensive examples.

### Quick Start

```typescript
import { WhaleTracker } from '@trading-bot/sentiment';

const tracker = new WhaleTracker();

// Fetch recent whale transactions
const activities = await tracker.fetchWhaleAlertTransactions('BTC', undefined, 10);

// Analyze activity
const analysis = tracker.analyzeActivity(activities);
console.log(`Score: ${analysis.score}, Sentiment: ${analysis.significance}`);

// Check exchange flows
const flow = await tracker.getExchangeFlowAnalysis('ETH', 24);
console.log(`Net Flow: $${flow.netFlow.toLocaleString()}, Sentiment: ${flow.sentiment}`);
```

## Rate Limiting

- **Whale Alert**: 1 request/second
- **Etherscan**: 5 requests/second
- **BscScan**: 5 requests/second

## Interpretation Guide

### Exchange Flows
- **Inflow (to exchanges)**: Potential selling pressure (bearish)
- **Outflow (from exchanges)**: Potential accumulation (bullish)

### Stablecoin Flows
- **Inflow to exchanges**: Buying power entering (bullish)
- **Outflow from exchanges**: Buying power leaving (bearish)

### Significance Levels
- **LOW**: $100k - $500k
- **MEDIUM**: $500k - $1M
- **HIGH**: $1M - $5M
- **CRITICAL**: > $5M
