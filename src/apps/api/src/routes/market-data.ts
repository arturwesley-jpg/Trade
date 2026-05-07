import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { MarketTick, Candle } from '@trading-bot/market-data';
import { BinanceProvider, BybitProvider, BingXProvider, MarketDataCache } from '@trading-bot/market-data';

const tickerQuerySchema = z.object({
  symbols: z.string().optional(),
});

const candleParamsSchema = z.object({
  symbol: z.string(),
});

const candleQuerySchema = z.object({
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
  limit: z.coerce.number().int().positive().max(1000).default(100),
});

const historyQuerySchema = z.object({
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
  start: z.string().optional(),
  end: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).default(100),
});

export interface MarketDataRoutesOptions {
  cache?: MarketDataCache;
  providers?: {
    binance?: BinanceProvider;
    bybit?: BybitProvider;
    bingx?: BingXProvider;
  };
}

export async function registerMarketDataRoutes(
  app: FastifyInstance,
  options: MarketDataRoutesOptions = {}
) {
  const { cache, providers } = options;

  // GET /api/market/tickers - List all tickers
  app.get('/api/market/tickers', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = tickerQuerySchema.parse(request.query);
      const symbols = query.symbols?.split(',') || ['BTC-USDT', 'ETH-USDT'];

      const ticks: MarketTick[] = [];

      // Try to get from cache first
      if (cache) {
        for (const symbol of symbols) {
          const cachedTick = await cache.getTick(symbol);
          if (cachedTick) {
            ticks.push(cachedTick);
          }
        }
      }

      // If we got all ticks from cache, return them
      if (ticks.length === symbols.length) {
        return reply.send({
          data: ticks,
          source: 'cache',
        });
      }

      // Otherwise, return simulated data
      const simulatedTicks: MarketTick[] = symbols.map((symbol) => ({
        symbol,
        price: symbol === 'BTC-USDT' ? 100000 : 3000,
        volume: 1000000,
        timestamp: new Date(),
        provider: 'simulated',
        bid: symbol === 'BTC-USDT' ? 99990 : 2999,
        ask: symbol === 'BTC-USDT' ? 100010 : 3001,
        high24h: symbol === 'BTC-USDT' ? 101000 : 3050,
        low24h: symbol === 'BTC-USDT' ? 99000 : 2950,
        change24h: 2.5,
      }));

      return reply.send({
        data: simulatedTicks,
        source: 'simulated',
      });
    } catch (error) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid request',
        },
      });
    }
  });

  // GET /api/market/tickers/:symbol - Get ticker by symbol
  app.get<{ Params: { symbol: string } }>(
    '/api/market/tickers/:symbol',
    async (request, reply) => {
      try {
        const { symbol } = request.params;

        // Try cache first
        if (cache) {
          const cachedTick = await cache.getTick(symbol);
          if (cachedTick) {
            return reply.send({
              data: cachedTick,
              source: 'cache',
            });
          }
        }

        // Try providers - BinanceProvider uses events, not direct getTick
        // Skip provider check and use cache or simulated data

        // Return simulated data
        const simulatedTick: MarketTick = {
          symbol,
          price: symbol === 'BTC-USDT' ? 100000 : 3000,
          volume: 1000000,
          timestamp: new Date(),
          provider: 'simulated',
          bid: symbol === 'BTC-USDT' ? 99990 : 2999,
          ask: symbol === 'BTC-USDT' ? 100010 : 3001,
          high24h: symbol === 'BTC-USDT' ? 101000 : 3050,
          low24h: symbol === 'BTC-USDT' ? 99000 : 2950,
          change24h: 2.5,
        };

        return reply.send({
          data: simulatedTick,
          source: 'simulated',
        });
      } catch (error) {
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Internal server error',
          },
        });
      }
    }
  );

  // GET /api/market/candles/:symbol - Get OHLCV candles
  app.get<{ Params: { symbol: string } }>(
    '/api/market/candles/:symbol',
    async (request, reply) => {
      try {
        const params = candleParamsSchema.parse(request.params);
        const query = candleQuerySchema.parse(request.query);

        // Try cache first
        if (cache) {
          const cachedCandles = await cache.getCandles(
            params.symbol,
            query.interval,
            query.limit
          );
          if (cachedCandles.length > 0) {
            return reply.send({
              data: cachedCandles,
              source: 'cache',
              interval: query.interval,
              count: cachedCandles.length,
            });
          }
        }

        // Try providers
        if (providers?.binance) {
          try {
            const candles = await providers.binance.getCandles(
              params.symbol,
              query.interval,
              query.limit
            );
            if (candles.length > 0) {
              return reply.send({
                data: candles,
                source: 'binance',
                interval: query.interval,
                count: candles.length,
              });
            }
          } catch (error) {
            console.error('Binance provider error:', error);
          }
        }

        // Return simulated data
        const simulatedCandles = generateSimulatedCandles(
          params.symbol === 'BTC-USDT' ? 100000 : 3000,
          query.limit,
          query.interval
        );

        return reply.send({
          data: simulatedCandles,
          source: 'simulated',
          interval: query.interval,
          count: simulatedCandles.length,
        });
      } catch (error) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_REQUEST',
            message: error instanceof Error ? error.message : 'Invalid request',
          },
        });
      }
    }
  );

  // GET /api/market/history/:symbol - Get historical data
  app.get<{ Params: { symbol: string } }>(
    '/api/market/history/:symbol',
    async (request, reply) => {
      try {
        const params = candleParamsSchema.parse(request.params);
        const query = historyQuerySchema.parse(request.query);

        const startDate = query.start ? new Date(query.start) : undefined;
        const endDate = query.end ? new Date(query.end) : undefined;

        // Try cache with time range
        if (cache && startDate && endDate) {
          const cachedCandles = await cache.getCandlesByTimeRange(
            params.symbol,
            query.interval,
            startDate,
            endDate
          );
          if (cachedCandles.length > 0) {
            return reply.send({
              data: cachedCandles,
              source: 'cache',
              interval: query.interval,
              count: cachedCandles.length,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            });
          }
        }

        // Try providers
        if (providers?.binance) {
          try {
            const candles = await providers.binance.getCandles(
              params.symbol,
              query.interval,
              query.limit
            );
            if (candles.length > 0) {
              return reply.send({
                data: candles,
                source: 'binance',
                interval: query.interval,
                count: candles.length,
              });
            }
          } catch (error) {
            console.error('Binance provider error:', error);
          }
        }

        // Return simulated data
        const simulatedCandles = generateSimulatedCandles(
          params.symbol === 'BTC-USDT' ? 100000 : 3000,
          query.limit,
          query.interval
        );

        return reply.send({
          data: simulatedCandles,
          source: 'simulated',
          interval: query.interval,
          count: simulatedCandles.length,
        });
      } catch (error) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_REQUEST',
            message: error instanceof Error ? error.message : 'Invalid request',
          },
        });
      }
    }
  );
}

function generateSimulatedCandles(
  currentPrice: number,
  count: number,
  interval: string
): Candle[] {
  const candles: Candle[] = [];
  const intervalMs = getIntervalMs(interval);
  const now = Date.now();

  for (let i = count - 1; i >= 0; i--) {
    const volatility = 0.02;
    const trend = -0.0005 * i;
    const randomFactor = (Math.random() - 0.5) * volatility;

    const close = currentPrice * (1 + trend + randomFactor);
    const open = close * (1 + (Math.random() - 0.5) * volatility * 0.5);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.3);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.3);
    const volume = 1000000 + Math.random() * 500000;

    candles.push({
      symbol: currentPrice === 100000 ? 'BTC-USDT' : 'ETH-USDT',
      interval,
      open,
      high,
      low,
      close,
      volume,
      timestamp: new Date(now - i * intervalMs),
    });
  }

  return candles;
}

function getIntervalMs(interval: string): number {
  const intervals: Record<string, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };
  return intervals[interval] || 60 * 60 * 1000;
}
