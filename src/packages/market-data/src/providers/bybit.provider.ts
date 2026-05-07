import WebSocket from 'ws';
import axios from 'axios';
import { EventEmitter } from 'events';
import { MarketDataProvider, MarketTick, Candle, ProviderConfig, OrderBook, Trade } from '../types';

export class BybitProvider extends EventEmitter implements MarketDataProvider {
  private ws: WebSocket | null = null;
  private config: ProviderConfig;
  private reconnectAttempts = 0;
  private subscribedSymbols = new Set<string>();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ProviderConfig>) {
    super();
    this.config = {
      name: 'bybit',
      wsUrl: 'wss://stream.bybit.com/v5/public/linear',
      restUrl: 'https://api.bybit.com',
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
          console.log('[Bybit] WebSocket connected');
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
            console.error('[Bybit] Message parse error:', error);
          }
        });

        this.ws.on('error', (error) => {
          console.error('[Bybit] WebSocket error:', error);
          this.emit('error', error);
        });

        this.ws.on('close', () => {
          console.log('[Bybit] WebSocket disconnected');
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
      op: 'subscribe',
      args: [`tickers.${formattedSymbol}`],
    };

    this.send(subscribeMsg);
    this.subscribedSymbols.add(symbol);
  }

  async unsubscribeTicker(symbol: string): Promise<void> {
    const formattedSymbol = this.formatSymbol(symbol);
    const unsubscribeMsg = {
      op: 'unsubscribe',
      args: [`tickers.${formattedSymbol}`],
    };

    this.send(unsubscribeMsg);
    this.subscribedSymbols.delete(symbol);
  }

  async subscribeOrderBook(symbol: string): Promise<void> {
    const formattedSymbol = this.formatSymbol(symbol);
    const subscribeMsg = {
      op: 'subscribe',
      args: [`orderbook.50.${formattedSymbol}`],
    };

    this.send(subscribeMsg);
  }

  async subscribeTrades(symbol: string): Promise<void> {
    const formattedSymbol = this.formatSymbol(symbol);
    const subscribeMsg = {
      op: 'subscribe',
      args: [`publicTrade.${formattedSymbol}`],
    };

    this.send(subscribeMsg);
  }

  async getCandles(symbol: string, interval: string, limit: number = 100): Promise<Candle[]> {
    try {
      const formattedSymbol = this.formatSymbol(symbol);
      const response = await axios.get(`${this.config.restUrl}/v5/market/kline`, {
        params: {
          category: 'linear',
          symbol: formattedSymbol,
          interval: this.mapInterval(interval),
          limit,
        },
      });

      if (response.data.retCode !== 0) {
        throw new Error(`Bybit API error: ${response.data.retMsg}`);
      }

      return response.data.result.list.map((candle: any[]) => ({
        symbol,
        interval,
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        timestamp: new Date(parseInt(candle[0])),
      })).reverse();
    } catch (error) {
      console.error('[Bybit] Failed to fetch candles:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private handleMessage(message: any): void {
    if (message.op === 'pong') {
      return;
    }

    if (message.topic && message.topic.startsWith('tickers.')) {
      const data = message.data;
      const tick: MarketTick = {
        symbol: this.normalizeSymbol(data.symbol),
        price: parseFloat(data.lastPrice),
        volume: parseFloat(data.volume24h),
        timestamp: new Date(parseInt(data.ts)),
        provider: 'bybit',
        bid: parseFloat(data.bid1Price),
        ask: parseFloat(data.ask1Price),
        high24h: parseFloat(data.highPrice24h),
        low24h: parseFloat(data.lowPrice24h),
        change24h: parseFloat(data.price24hPcnt) * 100,
      };
      this.emit('tick', tick);
    } else if (message.topic && message.topic.startsWith('orderbook.')) {
      const data = message.data;
      const orderbook: OrderBook = {
        symbol: this.normalizeSymbol(data.s),
        bids: data.b.map((b: any) => [parseFloat(b[0]), parseFloat(b[1])]),
        asks: data.a.map((a: any) => [parseFloat(a[0]), parseFloat(a[1])]),
        timestamp: new Date(parseInt(data.ts)),
      };
      this.emit('orderbook', orderbook);
    } else if (message.topic && message.topic.startsWith('publicTrade.')) {
      const data = message.data[0];
      const trade: Trade = {
        symbol: this.normalizeSymbol(data.s),
        price: parseFloat(data.p),
        quantity: parseFloat(data.v),
        side: data.S,
        timestamp: new Date(parseInt(data.T)),
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
        this.send({ op: 'ping' });
      }
    }, 20000);
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
      console.log(`[Bybit] Reconnecting... Attempt ${this.reconnectAttempts}`);

      setTimeout(() => {
        this.connect().then(() => {
          // Resubscribe to all symbols
          this.subscribedSymbols.forEach(symbol => {
            this.subscribeTicker(symbol);
          });
        });
      }, this.config.reconnectDelay);
    } else {
      console.error('[Bybit] Max reconnect attempts reached');
      this.emit('error', new Error('Max reconnect attempts reached'));
    }
  }

  private formatSymbol(symbol: string): string {
    // Convert BTC-USDT to BTCUSDT
    return symbol.replace('-', '').toUpperCase();
  }

  private normalizeSymbol(symbol: string): string {
    // Convert BTCUSDT to BTC-USDT
    return symbol.replace(/([A-Z]+)(USDT|BUSD|BTC|ETH)$/, '$1-$2');
  }

  private mapInterval(interval: string): string {
    const map: Record<string, string> = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '1h': '60',
      '4h': '240',
      '1d': 'D',
    };
    return map[interval] || '1';
  }
}
