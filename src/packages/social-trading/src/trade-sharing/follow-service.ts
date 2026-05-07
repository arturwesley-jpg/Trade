/**
 * Follow Service
 * Manages follow relationships between traders
 */

import { EventEmitter } from 'events';
import type { FollowRelationship } from '../types.js';

export class FollowService extends EventEmitter {
  private relationships: Map<string, FollowRelationship> = new Map();
  private followerIndex: Map<string, Set<string>> = new Map(); // traderId -> Set of followerIds
  private followingIndex: Map<string, Set<string>> = new Map(); // followerId -> Set of traderIds

  async follow(
    followerId: string,
    traderId: string,
    notifications?: {
      newTrade?: boolean;
      newPost?: boolean;
      performanceAlert?: boolean;
    }
  ): Promise<FollowRelationship> {
    if (followerId === traderId) {
      throw new Error('Cannot follow yourself');
    }

    const relationshipId = this.getRelationshipId(followerId, traderId);

    if (this.relationships.has(relationshipId)) {
      throw new Error('Already following this trader');
    }

    const relationship: FollowRelationship = {
      id: relationshipId,
      followerId,
      traderId,
      notifications: {
        newTrade: notifications?.newTrade ?? true,
        newPost: notifications?.newPost ?? true,
        performanceAlert: notifications?.performanceAlert ?? false,
      },
      createdAt: new Date(),
    };

    this.relationships.set(relationshipId, relationship);

    if (!this.followerIndex.has(traderId)) {
      this.followerIndex.set(traderId, new Set());
    }
    this.followerIndex.get(traderId)!.add(followerId);

    if (!this.followingIndex.has(followerId)) {
      this.followingIndex.set(followerId, new Set());
    }
    this.followingIndex.get(followerId)!.add(traderId);

    this.emit('followed', { followerId, traderId });

    return relationship;
  }

  async unfollow(followerId: string, traderId: string): Promise<void> {
    const relationshipId = this.getRelationshipId(followerId, traderId);

    if (!this.relationships.has(relationshipId)) {
      throw new Error('Not following this trader');
    }

    this.relationships.delete(relationshipId);

    this.followerIndex.get(traderId)?.delete(followerId);
    this.followingIndex.get(followerId)?.delete(traderId);

    this.emit('unfollowed', { followerId, traderId });
  }

  async updateNotificationSettings(
    followerId: string,
    traderId: string,
    notifications: {
      newTrade?: boolean;
      newPost?: boolean;
      performanceAlert?: boolean;
    }
  ): Promise<FollowRelationship> {
    const relationshipId = this.getRelationshipId(followerId, traderId);
    const relationship = this.relationships.get(relationshipId);

    if (!relationship) {
      throw new Error('Not following this trader');
    }

    relationship.notifications = {
      ...relationship.notifications,
      ...notifications,
    };

    this.emit('notifications_updated', { followerId, traderId, notifications });

    return relationship;
  }

  async isFollowing(followerId: string, traderId: string): Promise<boolean> {
    const relationshipId = this.getRelationshipId(followerId, traderId);
    return this.relationships.has(relationshipId);
  }

  async getFollowers(traderId: string, limit: number = 50, offset: number = 0): Promise<{
    followerIds: string[];
    total: number;
    hasMore: boolean;
  }> {
    const followers = Array.from(this.followerIndex.get(traderId) || []);
    const followerIds = followers.slice(offset, offset + limit);

    return {
      followerIds,
      total: followers.length,
      hasMore: offset + limit < followers.length,
    };
  }

  async getFollowing(followerId: string, limit: number = 50, offset: number = 0): Promise<{
    traderIds: string[];
    total: number;
    hasMore: boolean;
  }> {
    const following = Array.from(this.followingIndex.get(followerId) || []);
    const traderIds = following.slice(offset, offset + limit);

    return {
      traderIds,
      total: following.length,
      hasMore: offset + limit < following.length,
    };
  }

  async getFollowerCount(traderId: string): Promise<number> {
    return this.followerIndex.get(traderId)?.size || 0;
  }

  async getFollowingCount(followerId: string): Promise<number> {
    return this.followingIndex.get(followerId)?.size || 0;
  }

  async getRelationship(followerId: string, traderId: string): Promise<FollowRelationship | null> {
    const relationshipId = this.getRelationshipId(followerId, traderId);
    return this.relationships.get(relationshipId) || null;
  }

  private getRelationshipId(followerId: string, traderId: string): string {
    return `${followerId}:${traderId}`;
  }
}
