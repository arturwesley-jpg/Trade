/**
 * Activity Feed Service
 * Generates and manages activity feeds for users
 */

import { EventEmitter } from 'events';
import type { ActivityFeedItem, TradeAlert } from '../types.js';

export class ActivityFeedService extends EventEmitter {
  private feedItems: Map<string, ActivityFeedItem[]> = new Map();
  private maxItemsPerUser = 1000;

  async addTradeActivity(
    userId: string,
    username: string,
    displayName: string,
    avatarUrl: string | undefined,
    verified: boolean,
    tradeData: {
      tradeId: string;
      symbol: string;
      side: 'buy' | 'sell';
      pnl?: number;
      pnlPercent?: number;
    }
  ): Promise<ActivityFeedItem> {
    const item: ActivityFeedItem = {
      id: this.generateId(),
      type: 'trade',
      userId,
      username,
      displayName,
      avatarUrl,
      verified,
      data: tradeData,
      createdAt: new Date(),
    };

    this.addFeedItem(userId, item);
    this.emit('activity_added', item);

    return item;
  }

  async addPostActivity(
    userId: string,
    username: string,
    displayName: string,
    avatarUrl: string | undefined,
    verified: boolean,
    postId: string
  ): Promise<ActivityFeedItem> {
    const item: ActivityFeedItem = {
      id: this.generateId(),
      type: 'post',
      userId,
      username,
      displayName,
      avatarUrl,
      verified,
      data: { postId },
      createdAt: new Date(),
    };

    this.addFeedItem(userId, item);
    this.emit('activity_added', item);

    return item;
  }

  async addFollowActivity(
    userId: string,
    username: string,
    displayName: string,
    avatarUrl: string | undefined,
    verified: boolean,
    followedUserId: string,
    followedUsername: string
  ): Promise<ActivityFeedItem> {
    const item: ActivityFeedItem = {
      id: this.generateId(),
      type: 'follow',
      userId,
      username,
      displayName,
      avatarUrl,
      verified,
      data: {
        followedUserId,
        followedUsername,
      },
      createdAt: new Date(),
    };

    this.addFeedItem(userId, item);
    this.emit('activity_added', item);

    return item;
  }

  async addCopyStartActivity(
    userId: string,
    username: string,
    displayName: string,
    avatarUrl: string | undefined,
    verified: boolean,
    traderId: string,
    traderUsername: string
  ): Promise<ActivityFeedItem> {
    const item: ActivityFeedItem = {
      id: this.generateId(),
      type: 'copy_start',
      userId,
      username,
      displayName,
      avatarUrl,
      verified,
      data: {
        followedUserId: traderId,
        followedUsername: traderUsername,
      },
      createdAt: new Date(),
    };

    this.addFeedItem(userId, item);
    this.emit('activity_added', item);

    return item;
  }

  async getFeed(
    userId: string,
    followedUserIds: string[],
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    items: ActivityFeedItem[];
    total: number;
    hasMore: boolean;
  }> {
    const relevantUserIds = [userId, ...followedUserIds];
    const allItems: ActivityFeedItem[] = [];

    for (const uid of relevantUserIds) {
      const userItems = this.feedItems.get(uid) || [];
      allItems.push(...userItems);
    }

    const sorted = allItems.sort((a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime()
    );

    const items = sorted.slice(offset, offset + limit);

    return {
      items,
      total: sorted.length,
      hasMore: offset + limit < sorted.length,
    };
  }

  async getUserActivity(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    items: ActivityFeedItem[];
    total: number;
    hasMore: boolean;
  }> {
    const userItems = this.feedItems.get(userId) || [];
    const sorted = [...userItems].sort((a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime()
    );

    const items = sorted.slice(offset, offset + limit);

    return {
      items,
      total: userItems.length,
      hasMore: offset + limit < userItems.length,
    };
  }

  private addFeedItem(userId: string, item: ActivityFeedItem): void {
    let items = this.feedItems.get(userId);
    if (!items) {
      items = [];
      this.feedItems.set(userId, items);
    }

    items.unshift(item);

    if (items.length > this.maxItemsPerUser) {
      items.splice(this.maxItemsPerUser);
    }
  }

  private generateId(): string {
    return `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
