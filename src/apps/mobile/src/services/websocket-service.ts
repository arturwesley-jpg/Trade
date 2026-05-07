import { WebSocketClient } from '@trade/shared/websocket-client';
import * as SecureStore from 'expo-secure-store';

const WS_URL = __DEV__
  ? 'ws://localhost:3000/ws'
  : 'wss://api.tradepro.com/ws';

class WebSocketService {
  private client: WebSocketClient | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(): Promise<void> {
    if (this.client?.isConnected()) {
      return;
    }

    const token = await SecureStore.getItemAsync('accessToken');

    this.client = new WebSocketClient({
      url: WS_URL,
      token: token || undefined,
      autoReconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: this.maxReconnectAttempts,
      heartbeatInterval: 30000,
    });

    this.setupEventHandlers();

    try {
      await this.client.connect();
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
  }

  subscribe(channel: string, callback: (data: any) => void): void {
    if (!this.client) {
      throw new Error('WebSocket not connected');
    }
    this.client.subscribe(channel, callback);
  }

  unsubscribe(channel: string, callback?: (data: any) => void): void {
    if (this.client) {
      this.client.unsubscribe(channel, callback);
    }
  }

  isConnected(): boolean {
    return this.client?.isConnected() ?? false;
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connected', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.client.on('disconnected', () => {
      console.log('WebSocket disconnected');
    });

    this.client.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.client.on('reconnecting', (attempt) => {
      console.log(`WebSocket reconnecting (attempt ${attempt})`);
      this.reconnectAttempts = attempt;
    });

    this.client.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed');
    });
  }
}

export const wsService = new WebSocketService();
