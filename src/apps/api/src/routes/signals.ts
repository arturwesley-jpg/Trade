/**
 * Enhanced Signal Routes
 *
 * API endpoints for signal generation and management with sentiment integration.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { EnhancedSignalService } from '@trade/trading-core';
import type { TradingSignal } from '@trade/trading-core/signals/signal-types.js';
import type { Candle } from '@trade/market-data';

export interface MarketDataProvider {
  getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]>;
  getTick(symbol: string): Promise<any>;
}

const signalQuerySchema = z.object({
  symbol: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(10),
  active: z.coerce.boolean().optional(),
});

const signalParamsSchema = z.object({
  symbol: z.string(),
});

const generateSignalSchema = z.object({
  symbol: z.string(),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
  lookback: z.number().int().positive().max(500).default(100),
  includeRiskLevels: z.boolean().default(true),
  minConfidence: z.number().int().min(0).max(100).optional(),
});

const signalHistorySchema = z.object({
  symbol: z.string(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

const batchGenerateSchema = z.object({
  symbols: z.array(z.string()).min(1).max(20),
  interval: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
  lookback: z.number().int().positive().max(500).default(100),
  includeRiskLevels: z.boolean().default(true),
  minConfidence: z.number().int().min(0).max(100).optional(),
});

export interface SignalRoutesOptions {
  signalService?: EnhancedSignalService;
  marketDataProvider?: MarketDataProvider;
}

export async function registerSignalRoutes(
  app: FastifyInstance,
  options: SignalRoutesOptions = {}
) {
  const { signalService, marketDataProvider } = options;

  // GET /api/signals - List signals (active or recent)
  app.get('/api/signals', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = signalQuerySchema.parse(request.query);

      if (!signalService) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Signal service not configured',
          },
        });
      }

      let signals: TradingSignal[];

      if (query.active === true) {
        signals = await signalService.getActiveSignals(query.symbol);
      } else if (query.symbol) {
        signals = await signalService.getRecentSignals(query.symbol, query.limit);
      } else {
        signals = [];
      }

      return reply.send({
        data: signals,
        count: signals.length,
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

  // GET /api/signals/active - Get all active signals
  app.get('/api/signals/active', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!signalService) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Signal service not configured',
          },
        });
      }

      const signals = await signalService.getActiveSignals();

      return reply.send({
        data: signals,
        count: signals.length,
      });
    } catch (error) {
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch active signals',
        },
      });
    }
  });

  // GET /api/signals/:symbol - Get latest signal for symbol
  app.get<{ Params: { symbol: string } }>(
    '/api/signals/:symbol',
    async (request, reply) => {
      try {
        const params = signalParamsSchema.parse(request.params);

        if (!signalService) {
          return reply.status(503).send({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Signal service not configured',
            },
          });
        }

        const signal = await signalService.getLatestSignal(params.symbol);

        if (!signal) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `No signal found for symbol ${params.symbol}`,
            },
          });
        }

        return reply.send({
          data: signal,
        });
      } catch (error) {
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Failed to fetch signal',
          },
        });
      }
    }
  );

  // GET /api/signals/history/:symbol - Get signal history
  app.get<{ Params: { symbol: string }; Querystring: { limit?: number } }>(
    '/api/signals/history/:symbol',
    async (request, reply) => {
      try {
        const params = signalHistorySchema.parse({
          symbol: request.params.symbol,
          limit: request.query.limit,
        });

        if (!signalService) {
          return reply.status(503).send({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Signal service not configured',
            },
          });
        }

        const history = await signalService.getSignalHistory(
          params.symbol,
          params.limit
        );

        return reply.send({
          data: history,
        });
      } catch (error) {
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Failed to fetch signal history',
          },
        });
      }
    }
  );

  // POST /api/signals/generate - Generate signal on demand
  app.post('/api/signals/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = generateSignalSchema.parse(request.body);

      if (!signalService) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Signal service not configured',
          },
        });
      }

      if (!marketDataProvider) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Market data provider not configured',
          },
        });
      }

      // Fetch candles
      const candles = await marketDataProvider.getCandles(
        body.symbol,
        body.interval,
        body.lookback
      );

      if (candles.length === 0) {
        return reply.status(404).send({
          error: {
            code: 'NO_DATA',
            message: `No market data available for ${body.symbol}`,
          },
        });
      }

      // Generate signal
      const signal = await signalService.generateSignal(candles, {
        symbol: body.symbol,
        includeRiskLevels: body.includeRiskLevels,
        minConfidence: body.minConfidence,
      });

      if (!signal) {
        return reply.status(200).send({
          data: null,
          message: 'Insufficient data to generate signal',
        });
      }

      return reply.send({
        data: signal,
      });
    } catch (error) {
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate signal',
        },
      });
    }
  });

  // POST /api/signals/generate/batch - Generate signals for multiple symbols
  app.post('/api/signals/generate/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = batchGenerateSchema.parse(request.body);

      if (!signalService) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Signal service not configured',
          },
        });
      }

      if (!marketDataProvider) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Market data provider not configured',
          },
        });
      }

      // Fetch candles for all symbols
      const candlesBySymbol = new Map<string, Candle[]>();
      const errors: { symbol: string; error: string }[] = [];

      await Promise.all(
        body.symbols.map(async (symbol) => {
          try {
            const candles = await marketDataProvider.getCandles(
              symbol,
              body.interval,
              body.lookback
            );
            if (candles.length > 0) {
              candlesBySymbol.set(symbol, candles);
            } else {
              errors.push({ symbol, error: 'No data available' });
            }
          } catch (error) {
            errors.push({
              symbol,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })
      );

      // Generate signals
      const signals = await signalService.generateSignalsBatch(
        candlesBySymbol,
        {
          includeRiskLevels: body.includeRiskLevels,
          minConfidence: body.minConfidence,
        }
      );

      // Convert Map to array
      const results = Array.from(signals.entries()).map(([symbol, signal]) => ({
        symbol,
        signal,
      }));

      return reply.send({
        data: results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate signals',
        },
      });
    }
  });

  // DELETE /api/signals/:symbol/cache - Invalidate signal cache
  app.delete<{ Params: { symbol: string } }>(
    '/api/signals/:symbol/cache',
    async (request, reply) => {
      try {
        const params = signalParamsSchema.parse(request.params);

        if (!signalService) {
          return reply.status(503).send({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Signal service not configured',
            },
          });
        }

        await signalService.invalidateSignal(params.symbol);

        return reply.send({
          message: `Cache invalidated for ${params.symbol}`,
        });
      } catch (error) {
        return reply.status(500).send({
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Failed to invalidate cache',
          },
        });
      }
    }
  );
}
