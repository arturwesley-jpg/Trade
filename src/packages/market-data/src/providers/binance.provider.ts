import WebSocket from 'ws';
import axios from 'axios';
import { EventEmitter } from 'events';
import { MarketDataProvider, MarketTick, Candle, ProviderConfig, OrderBook, Trade } from '../types';

export class BinanceProvider extends EventEmitter implements MarketDataProvider {
  private ws: WebSocket | null = null;
  private config: ProviderConfig;
  private reconnectAttempts = 0;
  private subscribedSymbols = new Set<string>();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ProviderConfig>) {
    super();
    this.config = {
      name: 'binance',
      wsUrl: 'wss://stream.binance.com:9443/ws',
      restUrl: 'https://api.binance.com',
      reconnectDelay: config?.reconnectDelay || 5000,
      maxReconnectAttempts: config?.maxReconnectAttempts || 10,
      ...config,
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl);

        this.ws.on('open', () => {
          console.log('[Binance] WebSocket connected');
          this.reconnectAttempts = 0;
          this.startPing();
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.error('[Binance] Message parse error:', error);
          }
        });

        this.ws.on('error', (error) => {
          console.error('[Binance] WebSocket error:', error);
          this.emit('error', error);
        });

        this.ws.on('close', () => {
          console.log('[Binance] WebSocket disconnected');
          this.stopPing();
          this.emit('disconnected');
          this.handleReconnect();
        });

        this.ws.on('ping', () => {
          this.ws?.pong();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribedSymbols.clear();
  }

  async subscribeTicker(symbol: string): Promise<void> {
    const stream = this.formatSymbol(symbol);
    const subscribeMsg = {
      method: 'SUBSCRIBE',
      params: [`${stream}@ticker`],
      id: Date.now(),
    };

    this.send(subscribeMsg);
    this.subscribedSymbols.add(symbol);
  }

  async unsubscribeTicker(symbol: string): Promise<void> {
    const stream = this.formatSymbol(symbol);
    const unsubscribeMsg = {
      method: 'UNSUBSCRIBE',
      params: [`${stream}@ticker`],
      id: Date.now(),
    };

    this.send(unsubscribeMsg);
    this.subscribedSymbols.delete(symbol);
  }

  async subscribeOrderBook(symbol: string): Promise<void> {
    const stream = this.formatSymbol(symbol);
    const subscribeMsg = {
      method: 'SUBSCRIBE',
      params: [`${stream}@depth20@100ms`],
      id: Date.now(),
    };

    this.send(subscribeMsg);
  }

  async subscribeTrades(symbol: string): Promise<void> {
    const stream = this.formatSymbol(symbol);
    const subscribeMsg = {
      method: 'SUBSCRIBE',
      params: [`${stream}@trade`],
      id: Date.now(),
    };

    this.send(subscribeMsg);
  }

  async getCandles(symbol: string, interval: string, limit: number = 100): Promise<Candle[]> {
    try {
      const formattedSymbol = this.formatSymbol(symbol);
      const response = await axios.get(`${this.config.restUrl}/api/v3/klines`, {
        params: {
          symbol: formattedSymbol.toUpperCase(),
          interval: this.mapInterval(interval),
          limit,
        },
      });

      return response.data.map((candle: any[]) => ({
        symbol,
        interval,
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        timestamp: new Date(candle[0]),
      }));
    } catch (error) {
      console.error('[Binance] Failed to fetch candles:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private handleMessage(message: any): void {
    if (message.e === '24hrTicker') {
      const tick: MarketTick = {
        symbol: this.normalizeSymbol(message.s),
        price: parseFloat(message.c),
        volume: parseFloat(message.v),
        timestamp: new Date(message.E),
        provider: 'binance',
        bid: parseFloat(message.b),
        ask: parseFloat(message.a),
        high24h: parseFloat(message.h),
        low24h: parseFloat(message.l),
        change24h: parseFloat(message.P),
      };
      this.emit('tick', tick);
    } else if (message.e === 'depthUpdate') {
      const orderbook: OrderBook = {
        symbol: this.normalizeSymbol(message.s),
        bids: message.b.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
        asks: message.a.map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
        timestamp: new Date(message.E),
      };
      this.emit('orderbook', orderbook);
    } else if (message.e === 'trade') {
      const trade: Trade = {
        symbol: this.normalizeSymbol(message.s),
        price: parseFloat(message.p),
        quantity: parseFloat(message.q),
        side: message.m ? 'SELL' : 'BUY',
        timestamp: new Date(message.T),
      };
      this.emit('trade', trade);
    }
  }

  private send(data: any): void {
    if (this.isConnected()) {
      this.ws!.send(JSON.stringify(data));
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.ws!.ping();
      }
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.config.maxReconnectAttempts!) {
      this.reconnectAttempts++;
      console.log(`[Binance] Reconnecting... Attempt ${this.reconnectAttempts}`);

      setTimeout(() => {
        this.connect().then(() => {
          // Resubscribe to all symbols
          this.subscribedSymbols.forEach(symbol => {
            this.subscribeTicker(symbol);
          });
        });
      }, this.config.reconnectDelay);
    } else {
      console.error('[Binance] Max reconnect attempts reached');
      this.emit('error', new Error('Max reconnect attempts reached'));
    }
  }

  private formatSymbol(symbol: string): string {
    return symbol.replace('-', '').toLowerCase();
  }

  private normalizeSymbol(symbol: string): string {
    // Convert BTCUSDT to BTC-USDT
    return symbol.replace(/([A-Z]+)(USDT|BUSD|BTC|ETH)$/, '$1-$2');
  }

  private mapInterval(interval: string): string {
    const map: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
    };
    return map[interval] || '1m';
  }
}
