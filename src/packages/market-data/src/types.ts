export interface MarketTick {
  symbol: string;
  price: number;
  volume: number;
  timestamp: Date;
  provider: string;
  bid?: number;
  ask?: number;
  high24h?: number;
  low24h?: number;
  change24h?: number;
}

export interface OrderBook {
  symbol: string;
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][];
  timestamp: Date;
}

export interface Trade {
  symbol: string;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  timestamp: Date;
}

export interface Candle {
  symbol: string;
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

export interface ProviderConfig {
  name: string;
  wsUrl: string;
  restUrl: string;
  apiKey?: string;
  apiSecret?: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export interface MarketDataProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribeTicker(symbol: string): Promise<void>;
  unsubscribeTicker(symbol: string): Promise<void>;
  subscribeOrderBook(symbol: string): Promise<void>;
  subscribeTrades(symbol: string): Promise<void>;
  getCandles(symbol: string, interval: string, limit?: number): Promise<Candle[]>;
  isConnected(): boolean;
  on(event: 'tick', handler: (tick: MarketTick) => void): void;
  on(event: 'orderbook', handler: (orderbook: OrderBook) => void): void;
  on(event: 'trade', handler: (trade: Trade) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: 'connected', handler: () => void): void;
  on(event: 'disconnected', handler: () => void): void;
}
