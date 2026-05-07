# Market Data Package

Real-time market data providers and aggregation for Trading Bot.

## Features

- **Multi-Exchange Support**: Binance, Bybit, BingX
- **WebSocket Connections**: Real-time tick data
- **Candle Aggregation**: Generate OHLCV candles from ticks
- **Redis Caching**: High-performance data caching
- **Auto-Reconnection**: Resilient connection handling
- **Type-Safe**: Full TypeScript support

## Installation

```bash
npm install
npm run build
```

## Usage

### Initialize Providers

```typescript
import { BinanceProvider, BybitProvider, BingXProvider } from '@trading-bot/market-data';

// Binance
const binance = new BinanceProvider();
await binance.connect();

binance.on('tick', (tick) => {
  console.log('Binance tick:', tick);
});

await binance.subscribeTicker('BTC-USDT');

// Bybit
const bybit = new BybitProvider();
await bybit.connect();

bybit.on('tick', (tick) => {
  console.log('Bybit tick:', tick);
});

await bybit.subscribeTicker('BTC-USDT');

// BingX
const bingx = new BingXProvider();
await bingx.connect();

bingx.on('tick', (tick) => {
  console.log('BingX tick:', tick);
});

await bingx.subscribeTicker('BTC-USDT');
```

### Candle Aggregation

```typescript
import { CandleAggregator } from '@trading-bot/market-data';

const aggregator = new CandleAggregator({
  intervals: ['1m', '5m', '15m', '1h', '4h', '1d'],
  flushInterval: 60000, // Clean old candles every minute
});

aggregator.start();

binance.on('tick', (tick) => {
  const candles = aggregator.processTick(tick);
  console.log('Updated candles:', candles);
});

// Get latest candle
const latestCandle = aggregator.getCandle('BTC-USDT', '1m');

// Get multiple candles
const candles = aggregator.getCandles('BTC-USDT', '1h', 100);
```

### Redis Caching

```typescript
import { MarketDataCache } from '@trading-bot/market-data';

const cache = new MarketDataCache({
  host: 'localhost',
  port: 6379,
  password: 'your-password',
  ttl: {
    tick: 60, // 1 minute
    candle: 3600, // 1 hour
  },
});

// Cache tick
await cache.setTick(tick);

// Get cached tick
const cachedTick = await cache.getTick('BTC-USDT');

// Cache candle
await cache.setCandle(candle);

// Get cached candles
const cachedCandles = await cache.getCandles('BTC-USDT', '1m', 100);

// Get candles by time range
const rangeCandles = await cache.getCandlesByTimeRange(
  'BTC-USDT',
  '1h',
  new Date('2024-01-01'),
  new Date('2024-01-02')
);

// Batch operations
await cache.setTickBatch([tick1, tick2, tick3]);
await cache.setCandleBatch([candle1, candle2, candle3]);

// Cache stats
const stats = await cache.getStats();
console.log('Cache stats:', stats);
```

### Get Historical Candles

```typescript
// From Binance
const candles = await binance.getCandles('BTC-USDT', '1h', 100);

// From Bybit
const candles = await bybit.getCandles('BTC-USDT', '1h', 100);

// From BingX
const candles = await bingx.getCandles('BTC-USDT', '1h', 100);
```

### Subscribe to Order Book

```typescript
binance.on('orderbook', (orderbook) => {
  console.log('Order book:', orderbook);
});

await binance.subscribeOrderBook('BTC-USDT');
```

### Subscribe to Trades

```typescript
binance.on('trade', (trade) => {
  console.log('Trade:', trade);
});

await binance.subscribeTrades('BTC-USDT');
```

## Events

All providers emit the following events:

- `tick` - Market tick data
- `orderbook` - Order book snapshot
- `trade` - Individual trade
- `connected` - Connection established
- `disconnected` - Connection lost
- `error` - Error occurred

## Data Types

### MarketTick

```typescript
interface MarketTick {
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
```

### Candle

```typescript
interface Candle {
  symbol: string;
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}
```

### OrderBook

```typescript
interface OrderBook {
  symbol: string;
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][];
  timestamp: Date;
}
```

### Trade

```typescript
interface Trade {
  symbol: string;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  timestamp: Date;
}
```

## Supported Intervals

- `1m` - 1 minute
- `5m` - 5 minutes
- `15m` - 15 minutes
- `1h` - 1 hour
- `4h` - 4 hours
- `1d` - 1 day

## Configuration

### Provider Config

```typescript
interface ProviderConfig {
  name: string;
  wsUrl: string;
  restUrl: string;
  apiKey?: string;
  apiSecret?: string;
  reconnectDelay?: number; // Default: 5000ms
  maxReconnectAttempts?: number; // Default: 10
}
```

### Cache Config

```typescript
interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string; // Default: 'market:'
  ttl?: {
    tick: number; // Default: 60s
    candle: number; // Default: 3600s
  };
}
```

## Error Handling

```typescript
provider.on('error', (error) => {
  console.error('Provider error:', error);
});

// Check connection status
if (provider.isConnected()) {
  console.log('Provider is connected');
}

// Graceful disconnect
await provider.disconnect();
```

## Performance

- WebSocket connections with auto-reconnection
- Redis caching for fast data retrieval
- Efficient candle aggregation
- Batch operations support
- Memory-efficient data structures

## Testing

```bash
npm test
```

## License

MIT
