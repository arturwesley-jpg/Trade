import WebSocket from 'ws';
import axios from 'axios';
import { EventEmitter } from 'events';
import { MarketDataProvider, MarketTick, Candle, ProviderConfig, OrderBook, Trade } from '../types';

export class BingXProvider extends EventEmitter implements MarketDataProvider {
  private ws: WebSocket | null = null;
  private config: ProviderConfig;
  private reconnectAttempts = 0;
  private subscribedSymbols = new Set<string>();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ProviderConfig>) {
    super();
    this.config = {
      name: 'bingx',
      wsUrl: 'wss://open-api-swap.bingx.com/swap-market',
      restUrl: 'https://open-api.bingx.com',
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
          console.log('[BingX] WebSocket connected');
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
            console.error('[BingX] Message parse error:', error);
          }
        });

        this.ws.on('error', (error) => {
          console.error('[BingX] WebSocket error:', error);
          this.emit('error', error);
        });

        this.ws.on('close', () => {
          console.log('[BingX] WebSocket disconnected');
          this.stopPing();
          this.emit('disconnected');
          this.handleReconnect();
        });

        this.ws.on('pong', () => {
          // Keep connection alive
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
    const formattedSymbol = this.formatSymbol(symbol);
    const subscribeMsg = {
      id: Date.now().toString(),
      dataType: `${formattedSymbol}@ticker`,
    };

    this.send(subscribeMsg);
    this.subscribedSymbols.add(symbol);
  }

  async unsubscribeTicker(symbol: string): Promise<void> {
    const formattedSymbol = this.formatSymbol(symbol);
    const unsubscribeMsg = {
      id: Date.now().toString(),
      dataType: `${formattedSymbol}@ticker`,
      unsubscribe: true,
    };

    this.send(unsubscribeMsg);
    this.subscribedSymbols.delete(symbol);
  }

  async subscribeOrderBook(symbol: string): Promise<void> {
    const formattedSymbol = this.formatSymbol(symbol);
    const subscribeMsg = {
      id: Date.now().toString(),
      dataType: `${formattedSymbol}@depth20`,
    };

    this.send(subscribeMsg);
  }

  async subscribeTrades(symbol: string): Promise<void> {
    const formattedSymbol = this.formatSymbol(symbol);
    const subscribeMsg = {
      id: Date.now().toString(),
      dataType: `${formattedSymbol}@trade`,
    };

    this.send(subscribeMsg);
  }

  async getCandles(symbol: string, interval: string, limit: number = 100): Promise<Candle[]> {
    try {
      const formattedSymbol = this.formatSymbol(symbol);
      const response = await axios.get(`${this.config.restUrl}/openApi/swap/v2/quote/klines`, {
        params: {
          symbol: formattedSymbol,
          interval: this.mapInterval(interval),
          limit,
        },
      });

      if (response.data.code !== 0) {
        throw new Error(`BingX API error: ${response.data.msg}`);
      }

      return response.data.data.map((candle: any) => ({
        symbol,
        interval,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume),
        timestamp: new Date(candle.time),
      }));
    } catch (error) {
      console.error('[BingX] Failed to fetch candles:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private handleMessage(message: any): void {
    if (message.dataType && message.dataType.includes('@ticker')) {
      const data = message.data;
      const tick: MarketTick = {
        symbol: this.normalizeSymbol(data.s),
        price: parseFloat(data.c),
        volume: parseFloat(data.v),
        timestamp: new Date(data.E),
        provider: 'bingx',
        bid: parseFloat(data.b),
        ask: parseFloat(data.a),
        high24h: parseFloat(data.h),
        low24h: parseFloat(data.l),
        change24h: parseFloat(data.P),
      };
      this.emit('tick', tick);
    } else if (message.dataType && message.dataType.includes('@depth')) {
      const data = message.data;
      const orderbook: OrderBook = {
        symbol: this.normalizeSymbol(data.s),
        bids: data.bids.map((b: any) => [parseFloat(b[0]), parseFloat(b[1])]),
        asks: data.asks.map((a: any) => [parseFloat(a[0]), parseFloat(a[1])]),
        timestamp: new Date(data.E),
      };
      this.emit('orderbook', orderbook);
    } else if (message.dataType && message.dataType.includes('@trade')) {
      const data = message.data;
      const trade: Trade = {
        symbol: this.normalizeSymbol(data.s),
        price: parseFloat(data.p),
        quantity: parseFloat(data.q),
        side: data.m ? 'SELL' : 'BUY',
        timestamp: new Date(data.T),
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
        this.send({ ping: Date.now() });
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
      console.log(`[BingX] Reconnecting... Attempt ${this.reconnectAttempts}`);

      setTimeout(() => {
        this.connect().then(() => {
          // Resubscribe to all symbols
          this.subscribedSymbols.forEach(symbol => {
            this.subscribeTicker(symbol);
          });
        });
      }, this.config.reconnectDelay);
    } else {
      console.error('[BingX] Max reconnect attempts reached');
      this.emit('error', new Error('Max reconnect attempts reached'));
    }
  }

  private formatSymbol(symbol: string): string {
    // Convert BTC-USDT to BTC-USDT (BingX uses dash)
    return symbol.toUpperCase();
  }

  private normalizeSymbol(symbol: string): string {
    return symbol;
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
