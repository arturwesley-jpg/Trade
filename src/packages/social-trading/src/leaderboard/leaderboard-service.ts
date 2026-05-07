/**
 * Leaderboard Service
 * Manages trader rankings and leaderboard data
 */

import { RankingAlgorithm } from './ranking-algorithm.js';
import type {
  LeaderboardEntry,
  LeaderboardFilters,
  TraderProfile,
  TraderStats,
} from '../types.js';

export interface LeaderboardOptions {
  limit?: number;
  offset?: number;
  filters?: LeaderboardFilters;
}

export class LeaderboardService {
  private rankingAlgorithm: RankingAlgorithm;
  private cache: Map<string, { data: LeaderboardEntry[]; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(rankingAlgorithm?: RankingAlgorithm) {
    this.rankingAlgorithm = rankingAlgorithm || new RankingAlgorithm();
  }

  /**
   * Get leaderboard with rankings
   */
  async getLeaderboard(options: LeaderboardOptions = {}): Promise<{
    entries: LeaderboardEntry[];
    total: number;
    hasMore: boolean;
  }> {
    const { limit = 50, offset = 0, filters } = options;

    // Check cache
    const cacheKey = this.getCacheKey(options);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      const entries = cached.data.slice(offset, offset + limit);
      return {
        entries,
        total: cached.data.length,
        hasMore: offset + limit < cached.data.length,
      };
    }

    // Fetch trader profiles (this would come from database)
    const traders = await this.fetchTraders(filters);

    // Calculate scores and rank
    const rankedTraders = this.rankTraders(traders, filters);

    // Cache results
    this.cache.set(cacheKey, {
      data: rankedTraders,
      timestamp: Date.now(),
    });

    // Apply pagination
    const entries = rankedTraders.slice(offset, offset + limit);

    return {
      entries,
      total: rankedTraders.length,
      hasMore: offset + limit < rankedTraders.length,
    };
  }

  /**
   * Get trader rank
   */
  async getTraderRank(userId: string, filters?: LeaderboardFilters): Promise<{
    rank: number;
    score: number;
    total: number;
  } | null> {
    const leaderboard = await this.getLeaderboard({ filters });
    const entry = leaderboard.entries.find(e => e.userId === userId);

    if (!entry) return null;

    return {
      rank: entry.rank,
      score: entry.score,
      total: leaderboard.total,
    };
  }

  /**
   * Get top traders by specific metric
   */
  async getTopTradersByMetric(
    metric: 'returns' | 'winRate' | 'sharpe' | 'followers',
    limit: number = 10,
    filters?: LeaderboardFilters
  ): Promise<LeaderboardEntry[]> {
    const traders = await this.fetchTraders(filters);

    // Sort by specific metric
    const sorted = traders.sort((a, b) => {
      switch (metric) {
        case 'returns':
          return b.stats.totalReturnPercent - a.stats.totalReturnPercent;
        case 'winRate':
          return b.stats.winRate - a.stats.winRate;
        case 'sharpe':
          return b.stats.sharpeRatio - a.stats.sharpeRatio;
        case 'followers':
          return b.stats.followers - a.stats.followers;
        default:
          return 0;
      }
    });

    return sorted.slice(0, limit).map((trader, index) => ({
      rank: index + 1,
      userId: trader.userId,
      username: trader.username,
      displayName: trader.displayName,
      avatarUrl: trader.avatarUrl,
      verified: trader.verified,
      score: this.rankingAlgorithm.calculateScore(trader.stats),
      stats: {
        totalReturn: trader.stats.totalReturn,
        totalReturnPercent: trader.stats.totalReturnPercent,
        winRate: trader.stats.winRate,
        sharpeRatio: trader.stats.sharpeRatio,
        followers: trader.stats.followers,
        copiers: trader.stats.copiers,
        totalTrades: trader.stats.totalTrades,
      },
      riskLevel: trader.riskLevel,
    }));
  }

  /**
   * Rank traders and create leaderboard entries
   */
  private rankTraders(
    traders: TraderProfile[],
    filters?: LeaderboardFilters
  ): LeaderboardEntry[] {
    // Filter traders
    const filtered = traders.filter(trader =>
      this.rankingAlgorithm.applyFilters(trader.stats, filters || {})
    );

    // Calculate scores
    const scored = filtered.map(trader => ({
      trader,
      score: this.rankingAlgorithm.calculateScore(trader.stats),
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Create leaderboard entries with ranks
    return scored.map((item, index) => ({
      rank: index + 1,
      userId: item.trader.userId,
      username: item.trader.username,
      displayName: item.trader.displayName,
      avatarUrl: item.trader.avatarUrl,
      verified: item.trader.verified,
      score: item.score,
      stats: {
        totalReturn: item.trader.stats.totalReturn,
        totalReturnPercent: item.trader.stats.totalReturnPercent,
        winRate: item.trader.stats.winRate,
        sharpeRatio: item.trader.stats.sharpeRatio,
        followers: item.trader.stats.followers,
        copiers: item.trader.stats.copiers,
        totalTrades: item.trader.stats.totalTrades,
      },
      badges: this.assignBadges(item.trader.stats),
      riskLevel: item.trader.riskLevel,
    }));
  }

  /**
   * Assign badges based on achievements
   */
  private assignBadges(stats: TraderStats): string[] {
    const badges: string[] = [];

    if (stats.totalReturnPercent >= 100) badges.push('100%+ Returns');
    if (stats.winRate >= 70) badges.push('High Win Rate');
    if (stats.sharpeRatio >= 2) badges.push('Risk Master');
    if (stats.followers >= 1000) badges.push('Popular Trader');
    if (stats.copiers >= 100) badges.push('Most Copied');
    if (stats.totalTrades >= 500) badges.push('Active Trader');
    if (stats.consistencyScore >= 80) badges.push('Consistent');
    if (stats.maxDrawdownPercent > -10) badges.push('Low Drawdown');

    return badges;
  }

  /**
   * Fetch traders from database (mock implementation)
   */
  private async fetchTraders(filters?: LeaderboardFilters): Promise<TraderProfile[]> {
    // This would query the actual database
    // For now, return empty array
    // In real implementation:
    // 1. Query database with filters
    // 2. Apply timeframe filters
    // 3. Filter by strategy type, risk level, markets
    // 4. Return trader profiles with stats
    return [];
  }

  /**
   * Generate cache key from options
   */
  private getCacheKey(options: LeaderboardOptions): string {
    return JSON.stringify({
      filters: options.filters,
      // Don't include limit/offset in cache key
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for specific filters
   */
  clearCacheForFilters(filters: LeaderboardFilters): void {
    const key = this.getCacheKey({ filters });
    this.cache.delete(key);
  }
}
