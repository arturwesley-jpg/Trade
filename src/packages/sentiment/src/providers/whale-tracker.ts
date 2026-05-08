/**
 * Whale Activity Tracker
 *
 * Monitors large cryptocurrency transactions and exchange flows.
 * Integrates with Whale Alert API, blockchain explorers, and exchange flow monitoring.
 */

import type { WhaleActivity } from '../types';
import { logger } from '@trade/shared';
import { Cache } from '@trade/shared';

export interface WhaleTrackerConfig {
  minTransactionUSD?: number; // Minimum transaction size to track (default: 100k)
  significanceThresholds?: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  whaleAlertApiKey?: string;
  etherscanApiKey?: string;
  bscscanApiKey?: string;
  enableCaching?: boolean;
  cacheTTL?: number; // seconds
}

interface WhaleAlertTransaction {
  blockchain: string;
  symbol: string;
  amount: number;
  amount_usd: number;
  from: {
    address: string;
    owner?: string;
    owner_type?: string;
  };
  to: {
    address: string;
    owner?: string;
    owner_type?: string;
  };
  hash: string;
  timestamp: number;
}

interface WalletInfo {
  address: string;
  type: 'exchange' | 'whale' | 'smart_money' | 'unknown';
  label?: string;
  balance?: number;
  firstSeen?: Date;
  lastActive?: Date;
  transactionCount?: number;
}

interface AccumulationPattern {
  symbol: string;
  walletAddress: string;
  buyCount: number;
  totalAmount: number;
  totalUSD: number;
  averageSize: number;
  timespan: number; // hours
  confidence: number; // 0-100
}

export class WhaleTracker {
  private minTransactionUSD: number;
  private thresholds: Required<NonNullable<WhaleTrackerConfig['significanceThresholds']>>;
  private whaleAlertApiKey?: string;
  private etherscanApiKey?: string;
  private bscscanApiKey?: string;
  private cache?: Cache;
  private knownWallets: Map<string, WalletInfo> = new Map();
  private rateLimiters: Map<string, { lastCall: number; minInterval: number }> = new Map();

  constructor(config: WhaleTrackerConfig = {}) {
    this.minTransactionUSD = config.minTransactionUSD ?? 100000;
    this.thresholds = config.significanceThresholds ?? {
      low: 100000,
      medium: 500000,
      high: 1000000,
      critical: 5000000,
    };
    this.whaleAlertApiKey = config.whaleAlertApiKey || process.env.WHALE_ALERT_API_KEY;
    this.etherscanApiKey = config.etherscanApiKey || process.env.ETHERSCAN_API_KEY;
    this.bscscanApiKey = config.bscscanApiKey || process.env.BSCSCAN_API_KEY;

    if (config.enableCaching !== false) {
      this.cache = new Cache({
        ttl: config.cacheTTL || 300, // 5 minutes default
        maxSize: 1000,
      });
    }

    // Initialize rate limiters
    this.rateLimiters.set('whale-alert', { lastCall: 0, minInterval: 1000 }); // 1 req/sec
    this.rateLimiters.set('etherscan', { lastCall: 0, minInterval: 200 }); // 5 req/sec
    this.rateLimiters.set('bscscan', { lastCall: 0, minInterval: 200 }); // 5 req/sec
  }

  /**
   * Fetch recent whale transactions from Whale Alert API
   */
  async fetchWhaleAlertTransactions(
    symbol?: string,
    minValue?: number,
    limit: number = 100
  ): Promise<WhaleActivity[]> {
    if (!this.whaleAlertApiKey) {
      logger.warn('Whale Alert API key not configured');
      return [];
    }

    const cacheKey = `whale-alert:${symbol || 'all'}:${minValue || this.minTransactionUSD}`;
    if (this.cache) {
      const cached = await this.cache.get<WhaleActivity[]>(cacheKey);
      if (cached) return cached;
    }

    await this.enforceRateLimit('whale-alert');

    try {
      const params = new URLSearchParams({
        api_key: this.whaleAlertApiKey,
        min_value: String(minValue || this.minTransactionUSD),
        limit: String(limit),
      });

      if (symbol) {
        params.append('currency', symbol.toLowerCase());
      }

      const response = await fetch(
        `https://api.whale-alert.io/v1/transactions?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Whale Alert API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const activities = this.parseWhaleAlertResponse(data.transactions || []);

      if (this.cache) {
        await this.cache.set(cacheKey, activities);
      }

      return activities;
    } catch (error) {
      logger.error('Failed to fetch Whale Alert transactions', { error });
      return [];
    }
  }

  /**
   * Fetch wallet transactions from blockchain explorer
   */
  async fetchWalletTransactions(
    address: string,
    blockchain: 'ethereum' | 'bsc' = 'ethereum',
    limit: number = 100
  ): Promise<WhaleActivity[]> {
    const apiKey = blockchain === 'ethereum' ? this.etherscanApiKey : this.bscscanApiKey;
    if (!apiKey) {
      logger.warn(`${blockchain} API key not configured`);
      return [];
    }

    const cacheKey = `wallet-txs:${blockchain}:${address}`;
    if (this.cache) {
      const cached = await this.cache.get<WhaleActivity[]>(cacheKey);
      if (cached) return cached;
    }

    await this.enforceRateLimit(blockchain === 'ethereum' ? 'etherscan' : 'bscscan');

    try {
      const baseUrl =
        blockchain === 'ethereum'
          ? 'https://api.etherscan.io/api'
          : 'https://api.bscscan.com/api';

      const params = new URLSearchParams({
        module: 'account',
        action: 'txlist',
        address,
        startblock: '0',
        endblock: '99999999',
        page: '1',
        offset: String(limit),
        sort: 'desc',
        apikey: apiKey,
      });

      const response = await fetch(`${baseUrl}?${params.toString()}`);
      const data = await response.json();

      if (data.status !== '1') {
        throw new Error(`Blockchain explorer API error: ${data.message}`);
      }

      const activities = this.parseBlockchainExplorerResponse(data.result || [], blockchain);

      if (this.cache) {
        await this.cache.set(cacheKey, activities);
      }

      return activities;
    } catch (error) {
      logger.error('Failed to fetch wallet transactions', { error, address, blockchain });
      return [];
    }
  }

  /**
   * Detect accumulation patterns
   */
  async detectAccumulationPattern(
    walletAddress: string,
    symbol: string,
    timeWindowHours: number = 24
  ): Promise<AccumulationPattern | null> {
    const activities = await this.fetchWalletTransactions(walletAddress);
    const cutoffTime = Date.now() - timeWindowHours * 60 * 60 * 1000;

    const recentBuys = activities.filter(
      (a) =>
        a.symbol.toUpperCase() === symbol.toUpperCase() &&
        (a.type === 'EXCHANGE_OUTFLOW' || a.type === 'WHALE_ACCUMULATION') &&
        a.timestamp.getTime() >= cutoffTime
    );

    if (recentBuys.length < 3) {
      return null; // Need at least 3 buys to establish pattern
    }

    const totalAmount = recentBuys.reduce((sum, a) => sum + a.amount, 0);
    const totalUSD = recentBuys.reduce((sum, a) => sum + a.amountUSD, 0);
    const averageSize = totalUSD / recentBuys.length;

    // Calculate confidence based on consistency and size
    const sizeVariance = this.calculateVariance(recentBuys.map((a) => a.amountUSD));
    const consistencyScore = Math.max(0, 100 - sizeVariance / averageSize);
    const sizeScore = Math.min(100, (totalUSD / this.thresholds.high) * 50);
    const confidence = (consistencyScore * 0.6 + sizeScore * 0.4);

    return {
      symbol,
      walletAddress,
      buyCount: recentBuys.length,
      totalAmount,
      totalUSD,
      averageSize,
      timespan: timeWindowHours,
      confidence: Math.round(confidence),
    };
  }

  /**
   * Detect distribution patterns
   */
  async detectDistributionPattern(
    walletAddress: string,
    symbol: string,
    timeWindowHours: number = 24
  ): Promise<AccumulationPattern | null> {
    const activities = await this.fetchWalletTransactions(walletAddress);
    const cutoffTime = Date.now() - timeWindowHours * 60 * 60 * 1000;

    const recentSells = activities.filter(
      (a) =>
        a.symbol.toUpperCase() === symbol.toUpperCase() &&
        (a.type === 'EXCHANGE_INFLOW' || a.type === 'WHALE_DISTRIBUTION') &&
        a.timestamp.getTime() >= cutoffTime
    );

    if (recentSells.length < 3) {
      return null;
    }

    const totalAmount = recentSells.reduce((sum, a) => sum + a.amount, 0);
    const totalUSD = recentSells.reduce((sum, a) => sum + a.amountUSD, 0);
    const averageSize = totalUSD / recentSells.length;

    const sizeVariance = this.calculateVariance(recentSells.map((a) => a.amountUSD));
    const consistencyScore = Math.max(0, 100 - sizeVariance / averageSize);
    const sizeScore = Math.min(100, (totalUSD / this.thresholds.high) * 50);
    const confidence = (consistencyScore * 0.6 + sizeScore * 0.4);

    return {
      symbol,
      walletAddress,
      buyCount: recentSells.length,
      totalAmount,
      totalUSD,
      averageSize,
      timespan: timeWindowHours,
      confidence: Math.round(confidence),
    };
  }

  /**
   * Classify wallet type
   */
  async classifyWallet(address: string): Promise<WalletInfo> {
    // Check cache first
    if (this.knownWallets.has(address)) {
      return this.knownWallets.get(address)!;
    }

    const cacheKey = `wallet-info:${address}`;
    if (this.cache) {
      const cached = await this.cache.get<WalletInfo>(cacheKey);
      if (cached) {
        this.knownWallets.set(address, cached);
        return cached;
      }
    }

    // Fetch transaction history to classify
    const activities = await this.fetchWalletTransactions(address);

    let type: WalletInfo['type'] = 'unknown';
    let label: string | undefined;

    // Check if it's an exchange (high volume, many counterparties)
    const uniqueCounterparties = new Set(
      activities.map((a) => a.fromAddress || a.toAddress).filter(Boolean)
    );

    if (activities.length > 100 && uniqueCounterparties.size > 50) {
      type = 'exchange';
      label = 'Unidentified Exchange';
    } else if (activities.length > 20) {
      // Check for whale characteristics (large balances, significant transactions)
      const avgTransactionSize =
        activities.reduce((sum, a) => sum + a.amountUSD, 0) / activities.length;

      if (avgTransactionSize > this.thresholds.high) {
        type = 'whale';
      } else if (avgTransactionSize > this.thresholds.medium) {
        type = 'smart_money';
      }
    }

    const walletInfo: WalletInfo = {
      address,
      type,
      label,
      transactionCount: activities.length,
      firstSeen: activities.length > 0 ? activities[activities.length - 1].timestamp : undefined,
      lastActive: activities.length > 0 ? activities[0].timestamp : undefined,
    };

    this.knownWallets.set(address, walletInfo);
    if (this.cache) {
      await this.cache.set(cacheKey, walletInfo, 3600); // Cache for 1 hour
    }

    return walletInfo;
  }

  /**
   * Analyze whale activity significance
   */
  analyzeActivity(activities: WhaleActivity[]): {
    score: number; // -1 to 1
    significance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    summary: string;
  } {
    if (activities.length === 0) {
      return {
        score: 0,
        significance: 'LOW',
        summary: 'No significant whale activity detected',
      };
    }

    // Recent activity (last 24 hours)
    const now = Date.now();
    const recentActivities = activities.filter(a => {
      const ageHours = (now - a.timestamp.getTime()) / (1000 * 60 * 60);
      return ageHours <= 24;
    });

    if (recentActivities.length === 0) {
      return {
        score: 0,
        significance: 'LOW',
        summary: 'No recent whale activity',
      };
    }

    // Calculate score based on activity types
    let bullishScore = 0;
    let bearishScore = 0;
    let maxSignificance: WhaleActivity['significance'] = 'LOW';

    for (const activity of recentActivities) {
      const weight = this.getSignificanceWeight(activity.significance);

      if (activity.type === 'WHALE_ACCUMULATION' || activity.type === 'EXCHANGE_OUTFLOW') {
        bullishScore += weight;
      } else if (activity.type === 'WHALE_DISTRIBUTION' || activity.type === 'EXCHANGE_INFLOW') {
        bearishScore += weight;
      }

      // Track highest significance
      if (this.compareSignificance(activity.significance, maxSignificance) > 0) {
        maxSignificance = activity.significance;
      }
    }

    const totalScore = bullishScore + bearishScore;
    const netScore = totalScore > 0 ? (bullishScore - bearishScore) / totalScore : 0;

    const summary = this.generateSummary(recentActivities, netScore);

    return {
      score: netScore,
      significance: maxSignificance,
      summary,
    };
  }

  /**
   * Determine transaction significance
   */
  determineSignificance(amountUSD: number): WhaleActivity['significance'] {
    if (amountUSD >= this.thresholds.critical) return 'CRITICAL';
    if (amountUSD >= this.thresholds.high) return 'HIGH';
    if (amountUSD >= this.thresholds.medium) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Get significance weight for scoring
   */
  private getSignificanceWeight(significance: WhaleActivity['significance']): number {
    const weights = {
      LOW: 0.5,
      MEDIUM: 1.0,
      HIGH: 1.5,
      CRITICAL: 2.0,
    };
    return weights[significance];
  }

  /**
   * Compare significance levels
   */
  private compareSignificance(
    a: WhaleActivity['significance'],
    b: WhaleActivity['significance']
  ): number {
    const order = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
    return order[a] - order[b];
  }

  /**
   * Generate activity summary
   */
  private generateSummary(activities: WhaleActivity[], score: number): string {
    const accumulation = activities.filter(
      a => a.type === 'WHALE_ACCUMULATION' || a.type === 'EXCHANGE_OUTFLOW'
    ).length;
    const distribution = activities.filter(
      a => a.type === 'WHALE_DISTRIBUTION' || a.type === 'EXCHANGE_INFLOW'
    ).length;

    const totalVolume = activities.reduce((sum, a) => sum + a.amountUSD, 0);
    const volumeStr = this.formatUSD(totalVolume);

    if (score > 0.3) {
      return `Strong accumulation detected: ${accumulation} whale buys, ${volumeStr} total volume`;
    } else if (score < -0.3) {
      return `Strong distribution detected: ${distribution} whale sells, ${volumeStr} total volume`;
    } else {
      return `Mixed whale activity: ${activities.length} transactions, ${volumeStr} total volume`;
    }
  }

  /**
   * Format USD amount
   */
  private formatUSD(amount: number): string {
    if (amount >= 1000000000) {
      return `$${(amount / 1000000000).toFixed(2)}B`;
    } else if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(2)}K`;
    }
    return `$${amount.toFixed(2)}`;
  }

  /**
   * Parse Whale Alert API response
   */
  private parseWhaleAlertResponse(transactions: WhaleAlertTransaction[]): WhaleActivity[] {
    return transactions.map((tx) => {
      const type = this.determineTransactionType(tx);
      const significance = this.calculateSignificance(tx.amount_usd);

      return {
        symbol: tx.symbol.toUpperCase(),
        type,
        amount: tx.amount,
        amountUSD: tx.amount_usd,
        fromAddress: tx.from.address,
        toAddress: tx.to.address,
        txHash: tx.hash,
        timestamp: new Date(tx.timestamp * 1000),
        significance,
      };
    });
  }

  /**
   * Parse blockchain explorer response
   */
  private parseBlockchainExplorerResponse(
    transactions: any[],
    blockchain: string
  ): WhaleActivity[] {
    return transactions
      .map((tx) => {
        const valueInEth = parseFloat(tx.value) / 1e18;
        const amountUSD = valueInEth * 2000; // Simplified, should use real price

        if (amountUSD < this.minTransactionUSD) {
          return null;
        }

        const type = this.determineTransactionType({
          from: { address: tx.from, owner_type: 'unknown' },
          to: { address: tx.to, owner_type: 'unknown' },
          amount_usd: amountUSD,
        } as any);

        return {
          symbol: blockchain === 'ethereum' ? 'ETH' : 'BNB',
          type,
          amount: valueInEth,
          amountUSD,
          fromAddress: tx.from,
          toAddress: tx.to,
          txHash: tx.hash,
          timestamp: new Date(parseInt(tx.timeStamp) * 1000),
          significance: this.calculateSignificance(amountUSD),
        };
      })
      .filter((tx): tx is WhaleActivity => tx !== null);
  }

  /**
   * Determine transaction type based on addresses
   */
  private determineTransactionType(tx: WhaleAlertTransaction): WhaleActivity['type'] {
    const fromType = tx.from.owner_type?.toLowerCase();
    const toType = tx.to.owner_type?.toLowerCase();

    if (toType === 'exchange') {
      return 'EXCHANGE_INFLOW';
    } else if (fromType === 'exchange') {
      return 'EXCHANGE_OUTFLOW';
    } else if (tx.amount_usd > this.thresholds.high) {
      return 'LARGE_TRANSFER';
    }

    return 'LARGE_TRANSFER';
  }

  /**
   * Calculate transaction significance
   */
  private calculateSignificance(amountUSD: number): WhaleActivity['significance'] {
    if (amountUSD >= this.thresholds.critical) return 'CRITICAL';
    if (amountUSD >= this.thresholds.high) return 'HIGH';
    if (amountUSD >= this.thresholds.medium) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Enforce rate limiting for API calls
   */
  private async enforceRateLimit(service: string): Promise<void> {
    const limiter = this.rateLimiters.get(service);
    if (!limiter) return;

    const now = Date.now();
    const timeSinceLastCall = now - limiter.lastCall;

    if (timeSinceLastCall < limiter.minInterval) {
      const waitTime = limiter.minInterval - timeSinceLastCall;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    limiter.lastCall = Date.now();
  }

  /**
   * Calculate variance for consistency scoring
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length);
  }

  /**
   * Get exchange flow analysis for a symbol
   */
  async getExchangeFlowAnalysis(symbol: string, timeWindowHours: number = 24): Promise<{
    totalInflow: number;
    totalOutflow: number;
    netFlow: number;
    inflowCount: number;
    outflowCount: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }> {
    const activities = await this.fetchWhaleAlertTransactions(symbol);
    const cutoffTime = Date.now() - timeWindowHours * 60 * 60 * 1000;

    const recentActivities = activities.filter(
      (a) => a.timestamp.getTime() >= cutoffTime
    );

    let totalInflow = 0;
    let totalOutflow = 0;
    let inflowCount = 0;
    let outflowCount = 0;

    for (const activity of recentActivities) {
      if (activity.type === 'EXCHANGE_INFLOW') {
        totalInflow += activity.amountUSD;
        inflowCount++;
      } else if (activity.type === 'EXCHANGE_OUTFLOW') {
        totalOutflow += activity.amountUSD;
        outflowCount++;
      }
    }

    const netFlow = totalOutflow - totalInflow;
    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

    // Outflow (accumulation) is bullish, inflow (distribution) is bearish
    if (netFlow > this.thresholds.medium) {
      sentiment = 'BULLISH';
    } else if (netFlow < -this.thresholds.medium) {
      sentiment = 'BEARISH';
    }

    return {
      totalInflow,
      totalOutflow,
      netFlow,
      inflowCount,
      outflowCount,
      sentiment,
    };
  }

  /**
   * Track stablecoin flows
   */
  async getStablecoinFlows(timeWindowHours: number = 24): Promise<{
    totalInflow: number;
    totalOutflow: number;
    netFlow: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }> {
    const stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI'];
    let totalInflow = 0;
    let totalOutflow = 0;

    for (const stablecoin of stablecoins) {
      const analysis = await this.getExchangeFlowAnalysis(stablecoin, timeWindowHours);
      totalInflow += analysis.totalInflow;
      totalOutflow += analysis.totalOutflow;
    }

    const netFlow = totalInflow - totalOutflow;
    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

    // Stablecoin inflow to exchanges is bullish (buying power)
    if (netFlow > this.thresholds.critical) {
      sentiment = 'BULLISH';
    } else if (netFlow < -this.thresholds.critical) {
      sentiment = 'BEARISH';
    }

    return {
      totalInflow,
      totalOutflow,
      netFlow,
      sentiment,
    };
  }
}
