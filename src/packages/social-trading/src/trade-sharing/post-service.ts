/**
 * Post Service
 * Manages trade sharing posts and interactions
 */

import { EventEmitter } from 'events';
import type {
  TradePost,
  Comment,
  ActivityFeedItem,
  VisibilityLevel,
} from '../types.js';

export interface CreatePostInput {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  verified: boolean;
  type: 'trade_idea' | 'analysis' | 'update' | 'question';
  content: string;
  symbol?: string;
  side?: 'long' | 'short';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  timeframe?: string;
  tags?: string[];
  attachments?: {
    type: 'image' | 'chart';
    url: string;
  }[];
  visibility?: VisibilityLevel;
}

export interface CreateCommentInput {
  postId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  verified: boolean;
  content: string;
  parentCommentId?: string;
}

export class PostService extends EventEmitter {
  private posts: Map<string, TradePost> = new Map();
  private comments: Map<string, Comment[]> = new Map();
  private userReactions: Map<string, Set<string>> = new Map();

  async createPost(input: CreatePostInput): Promise<TradePost> {
    this.validatePostInput(input);

    const post: TradePost = {
      id: this.generateId(),
      userId: input.userId,
      username: input.username,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      verified: input.verified,
      type: input.type,
      content: input.content,
      symbol: input.symbol,
      side: input.side,
      entryPrice: input.entryPrice,
      targetPrice: input.targetPrice,
      stopLoss: input.stopLoss,
      timeframe: input.timeframe,
      tags: input.tags || [],
      attachments: input.attachments || [],
      reactions: {
        likes: 0,
        bullish: 0,
        bearish: 0,
      },
      commentCount: 0,
      shareCount: 0,
      visibility: input.visibility || 'public',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.posts.set(post.id, post);
    this.comments.set(post.id, []);

    this.emit('post_created', post);

    return post;
  }

  async getPost(postId: string): Promise<TradePost | null> {
    return this.posts.get(postId) || null;
  }

  async updatePost(
    postId: string,
    userId: string,
    updates: Partial<Pick<TradePost, 'content' | 'tags' | 'visibility'>>
  ): Promise<TradePost> {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    if (post.userId !== userId) {
      throw new Error('Unauthorized to update this post');
    }

    const updatedPost = {
      ...post,
      ...updates,
      updatedAt: new Date(),
    };

    this.posts.set(postId, updatedPost);

    this.emit('post_updated', updatedPost);

    return updatedPost;
  }

  async deletePost(postId: string, userId: string): Promise<void> {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    if (post.userId !== userId) {
      throw new Error('Unauthorized to delete this post');
    }

    this.posts.delete(postId);
    this.comments.delete(postId);
    this.userReactions.delete(postId);

    this.emit('post_deleted', { postId, userId });
  }

  async addReaction(
    postId: string,
    userId: string,
    reactionType: 'like' | 'bullish' | 'bearish'
  ): Promise<TradePost> {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    const reactionKey = `${postId}:${reactionType}`;
    let userReactions = this.userReactions.get(reactionKey);
    if (!userReactions) {
      userReactions = new Set();
      this.userReactions.set(reactionKey, userReactions);
    }

    if (userReactions.has(userId)) {
      throw new Error('User already reacted with this type');
    }

    userReactions.add(userId);
    post.reactions[reactionType === 'like' ? 'likes' : reactionType]++;
    post.updatedAt = new Date();

    this.emit('reaction_added', { postId, userId, reactionType });

    return post;
  }

  async removeReaction(
    postId: string,
    userId: string,
    reactionType: 'like' | 'bullish' | 'bearish'
  ): Promise<TradePost> {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    const reactionKey = `${postId}:${reactionType}`;
    const userReactions = this.userReactions.get(reactionKey);
    if (!userReactions || !userReactions.has(userId)) {
      throw new Error('User has not reacted with this type');
    }

    userReactions.delete(userId);
    post.reactions[reactionType === 'like' ? 'likes' : reactionType]--;
    post.updatedAt = new Date();

    this.emit('reaction_removed', { postId, userId, reactionType });

    return post;
  }

  async createComment(input: CreateCommentInput): Promise<Comment> {
    const post = this.posts.get(input.postId);
    if (!post) {
      throw new Error('Post not found');
    }

    if (input.parentCommentId) {
      const comments = this.comments.get(input.postId) || [];
      const parentExists = comments.some(c => c.id === input.parentCommentId);
      if (!parentExists) {
        throw new Error('Parent comment not found');
      }
    }

    const comment: Comment = {
      id: this.generateId(),
      postId: input.postId,
      userId: input.userId,
      username: input.username,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      verified: input.verified,
      content: input.content,
      parentCommentId: input.parentCommentId,
      reactions: {
        likes: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const comments = this.comments.get(input.postId) || [];
    comments.push(comment);
    this.comments.set(input.postId, comments);

    post.commentCount++;

    this.emit('comment_created', comment);

    return comment;
  }

  async getComments(postId: string, limit: number = 50, offset: number = 0): Promise<{
    comments: Comment[];
    total: number;
    hasMore: boolean;
  }> {
    const allComments = this.comments.get(postId) || [];

    const sorted = [...allComments].sort((a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime()
    );

    const comments = sorted.slice(offset, offset + limit);

    return {
      comments,
      total: allComments.length,
      hasMore: offset + limit < allComments.length,
    };
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    for (const [postId, comments] of this.comments.entries()) {
      const index = comments.findIndex(c => c.id === commentId);
      if (index !== -1) {
        const comment = comments[index];
        if (comment.userId !== userId) {
          throw new Error('Unauthorized to delete this comment');
        }

        comments.splice(index, 1);

        const post = this.posts.get(postId);
        if (post) {
          post.commentCount--;
        }

        this.emit('comment_deleted', { commentId, postId, userId });
        return;
      }
    }

    throw new Error('Comment not found');
  }

  async getFeed(
    userId: string,
    followedUserIds: string[],
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    posts: TradePost[];
    total: number;
    hasMore: boolean;
  }> {
    const relevantUserIds = new Set([userId, ...followedUserIds]);

    const feedPosts = Array.from(this.posts.values())
      .filter(post => {
        if (!relevantUserIds.has(post.userId)) return false;

        if (post.visibility === 'private' && post.userId !== userId) return false;
        if (post.visibility === 'followers' && !followedUserIds.includes(post.userId) && post.userId !== userId) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const posts = feedPosts.slice(offset, offset + limit);

    return {
      posts,
      total: feedPosts.length,
      hasMore: offset + limit < feedPosts.length,
    };
  }

  async getUserPosts(
    userId: string,
    viewerId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    posts: TradePost[];
    total: number;
    hasMore: boolean;
  }> {
    const userPosts = Array.from(this.posts.values())
      .filter(post => {
        if (post.userId !== userId) return false;

        if (post.visibility === 'private' && viewerId !== userId) return false;

        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const posts = userPosts.slice(offset, offset + limit);

    return {
      posts,
      total: userPosts.length,
      hasMore: offset + limit < userPosts.length,
    };
  }

  async searchPosts(
    query: string,
    filters?: {
      symbol?: string;
      type?: TradePost['type'];
      tags?: string[];
    },
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    posts: TradePost[];
    total: number;
    hasMore: boolean;
  }> {
    const lowerQuery = query.toLowerCase();

    const searchResults = Array.from(this.posts.values())
      .filter(post => {
        const matchesQuery = post.content.toLowerCase().includes(lowerQuery) ||
          post.symbol?.toLowerCase().includes(lowerQuery) ||
          post.tags?.some(tag => tag.toLowerCase().includes(lowerQuery));

        if (!matchesQuery) return false;

        if (filters?.symbol && post.symbol !== filters.symbol) return false;
        if (filters?.type && post.type !== filters.type) return false;
        if (filters?.tags && !filters.tags.some(tag => post.tags?.includes(tag))) return false;

        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const posts = searchResults.slice(offset, offset + limit);

    return {
      posts,
      total: searchResults.length,
      hasMore: offset + limit < searchResults.length,
    };
  }

  private validatePostInput(input: CreatePostInput): void {
    if (!input.content || input.content.trim().length === 0) {
      throw new Error('Post content cannot be empty');
    }

    if (input.content.length > 5000) {
      throw new Error('Post content exceeds maximum length of 5000 characters');
    }

    if (input.type === 'trade_idea' && !input.symbol) {
      throw new Error('Trade idea posts must include a symbol');
    }
  }

  private generateId(): string {
    return `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
