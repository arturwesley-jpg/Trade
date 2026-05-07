/**
 * Chat Service
 * Manages chat rooms and messaging
 */

import { EventEmitter } from 'events';
import type { ChatRoom, ChatMessage, DirectMessage } from '../types.js';

export class ChatService extends EventEmitter {
  private rooms: Map<string, ChatRoom> = new Map();
  private messages: Map<string, ChatMessage[]> = new Map();
  private directMessages: Map<string, DirectMessage[]> = new Map();
  private roomMembers: Map<string, Set<string>> = new Map();

  /**
   * Create a new chat room
   */
  async createRoom(
    name: string,
    description: string,
    type: 'public' | 'private' | 'trading_group',
    createdBy: string,
    symbol?: string
  ): Promise<ChatRoom> {
    const room: ChatRoom = {
      id: this.generateId(),
      name,
      description,
      type,
      symbol,
      memberCount: 1,
      createdBy,
      moderators: [createdBy],
      createdAt: new Date(),
    };

    this.rooms.set(room.id, room);
    this.messages.set(room.id, []);
    this.roomMembers.set(room.id, new Set([createdBy]));

    this.emit('room_created', room);

    return room;
  }

  /**
   * Get room by ID
   */
  async getRoom(roomId: string): Promise<ChatRoom | null> {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Get all public rooms
   */
  async getPublicRooms(limit: number = 50, offset: number = 0): Promise<{
    rooms: ChatRoom[];
    total: number;
    hasMore: boolean;
  }> {
    const publicRooms = Array.from(this.rooms.values())
      .filter(room => room.type === 'public')
      .sort((a, b) => b.memberCount - a.memberCount);

    const rooms = publicRooms.slice(offset, offset + limit);

    return {
      rooms,
      total: publicRooms.length,
      hasMore: offset + limit < publicRooms.length,
    };
  }

  /**
   * Get rooms for a symbol
   */
  async getSymbolRooms(symbol: string): Promise<ChatRoom[]> {
    return Array.from(this.rooms.values())
      .filter(room => room.symbol === symbol && room.type === 'public')
      .sort((a, b) => b.memberCount - a.memberCount);
  }

  /**
   * Join a room
   */
  async joinRoom(roomId: string, userId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.type === 'private') {
      throw new Error('Cannot join private room without invitation');
    }

    const members = this.roomMembers.get(roomId);
    if (!members) {
      throw new Error('Room members not found');
    }

    if (members.has(userId)) {
      throw new Error('Already a member of this room');
    }

    members.add(userId);
    room.memberCount++;

    this.emit('user_joined_room', { roomId, userId });

    // Add system message
    await this.addSystemMessage(roomId, `User ${userId} joined the room`);
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const members = this.roomMembers.get(roomId);
    if (!members || !members.has(userId)) {
      throw new Error('Not a member of this room');
    }

    members.delete(userId);
    room.memberCount--;

    this.emit('user_left_room', { roomId, userId });

    // Add system message
    await this.addSystemMessage(roomId, `User ${userId} left the room`);
  }

  /**
   * Send a message to a room
   */
  async sendMessage(
    roomId: string,
    userId: string,
    username: string,
    displayName: string,
    avatarUrl: string | undefined,
    verified: boolean,
    content: string,
    metadata?: {
      tradeId?: string;
      symbol?: string;
      price?: number;
    }
  ): Promise<ChatMessage> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const members = this.roomMembers.get(roomId);
    if (!members || !members.has(userId)) {
      throw new Error('Not a member of this room');
    }

    const message: ChatMessage = {
      id: this.generateId(),
      roomId,
      userId,
      username,
      displayName,
      avatarUrl,
      verified,
      content,
      type: metadata ? 'trade_alert' : 'text',
      metadata,
      reactions: {},
      createdAt: new Date(),
    };

    const messages = this.messages.get(roomId) || [];
    messages.push(message);
    this.messages.set(roomId, messages);

    this.emit('message_sent', message);

    return message;
  }

  /**
   * Get messages from a room
   */
  async getMessages(
    roomId: string,
    limit: number = 100,
    before?: Date
  ): Promise<ChatMessage[]> {
    const messages = this.messages.get(roomId) || [];

    let filtered = messages;
    if (before) {
      filtered = messages.filter(m => m.createdAt < before);
    }

    return filtered
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .reverse();
  }

  /**
   * Add reaction to message
   */
  async addMessageReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<void> {
    for (const messages of this.messages.values()) {
      const message = messages.find(m => m.id === messageId);
      if (message) {
        if (!message.reactions) {
          message.reactions = {};
        }
        message.reactions[emoji] = (message.reactions[emoji] || 0) + 1;

        this.emit('reaction_added', { messageId, userId, emoji });
        return;
      }
    }

    throw new Error('Message not found');
  }

  /**
   * Send direct message
   */
  async sendDirectMessage(
    senderId: string,
    receiverId: string,
    content: string
  ): Promise<DirectMessage> {
    if (senderId === receiverId) {
      throw new Error('Cannot send message to yourself');
    }

    const message: DirectMessage = {
      id: this.generateId(),
      senderId,
      receiverId,
      content,
      read: false,
      createdAt: new Date(),
    };

    const conversationKey = this.getConversationKey(senderId, receiverId);
    let conversation = this.directMessages.get(conversationKey);
    if (!conversation) {
      conversation = [];
      this.directMessages.set(conversationKey, conversation);
    }

    conversation.push(message);

    this.emit('direct_message_sent', message);

    return message;
  }

  /**
   * Get direct messages between two users
   */
  async getDirectMessages(
    userId1: string,
    userId2: string,
    limit: number = 50,
    before?: Date
  ): Promise<DirectMessage[]> {
    const conversationKey = this.getConversationKey(userId1, userId2);
    const messages = this.directMessages.get(conversationKey) || [];

    let filtered = messages;
    if (before) {
      filtered = messages.filter(m => m.createdAt < before);
    }

    return filtered
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .reverse();
  }

  /**
   * Mark direct message as read
   */
  async markAsRead(messageId: string, userId: string): Promise<void> {
    for (const messages of this.directMessages.values()) {
      const message = messages.find(m => m.id === messageId);
      if (message && message.receiverId === userId) {
        message.read = true;
        this.emit('message_read', { messageId, userId });
        return;
      }
    }

    throw new Error('Message not found');
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(userId: string): Promise<number> {
    let count = 0;

    for (const messages of this.directMessages.values()) {
      count += messages.filter(m => m.receiverId === userId && !m.read).length;
    }

    return count;
  }

  /**
   * Add system message to room
   */
  private async addSystemMessage(roomId: string, content: string): Promise<void> {
    const message: ChatMessage = {
      id: this.generateId(),
      roomId,
      userId: 'system',
      username: 'System',
      displayName: 'System',
      verified: true,
      content,
      type: 'system',
      createdAt: new Date(),
    };

    const messages = this.messages.get(roomId) || [];
    messages.push(message);
    this.messages.set(roomId, messages);
  }

  /**
   * Get conversation key for direct messages
   */
  private getConversationKey(userId1: string, userId2: string): string {
    return [userId1, userId2].sort().join(':');
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
