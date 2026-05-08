import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { WhaleTracker } from '@trade/sentiment';
import type { WhaleEvent } from '@trade/database';
import type { DatabaseClient } from '@trade/database';
import { logger } from '@trade/shared';

const whaleEventsQuerySchema = z.object({
  symbol: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const walletQuerySchema = z.object({
  address: z.string().min(1),
  blockchain: z.enum(['ethereum', 'bsc']).default('ethereum'),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

const whaleAnalysisQuerySchema = z.object({
  symbol: z.string().min(1),
  timeWindow: z.coerce.number().int().positive().max(168).default(24), // max 7 days
});

const accumulationQuerySchema = z.object({
  address: z.string().min(1),
  symbol: z.string().min(1),
  timeWindow: z.coerce.number().int().positive().max(168).default(24),
});

const exchangeFlowQuerySchema = z.object({
  symbol: z.string().min(1),
  timeWindow: z.coerce.number().int().positive().max(168).default(24),
});

export interface WhaleRoutesOptions {
  db?: DatabaseClient;
  whaleTracker?: WhaleTracker;
}

export function registerWhaleRoutes(
  app: FastifyInstance,
  options: WhaleRoutesOptions = {}
) {
  const { db, whaleTracker } = options;

  let repository: any | undefined;
  // TODO: Implement PostgresWhaleEventRepository
  // if (db) {
  //   repository = new PostgresWhaleEventRepository(db);
  // }

  // GET /api/whale/events - Get recent whale events
  app.get('/api/whale/events', async (request, reply) => {
    try {
      const query = whaleEventsQuerySchema.parse(request.query);

      if (!repository) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Database not configured',
          },
        });
      }

      let events;

      if (query.startDate && query.endDate) {
        events = await repository.findByTimeRange(
          new Date(query.startDate),
          new Date(query.endDate)
        );
      } else if (query.symbol) {
        events = await repository.findBySymbol(query.symbol, query.limit);
      } else if (query.severity) {
        events = await repository.findBySeverity(query.severity, query.limit);
      } else {
        events = await repository.findRecent(query.limit);
      }

      return reply.send({
        data: events,
        meta: {
          count: events.length,
          limit: query.limit,
        },
      });
    } catch (error) {
      logger.error('Failed to fetch whale events', { error });
      return reply.status(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid request',
        },
      });
    }
  });

  // GET /api/whale/wallets/:address - Get wallet activity
  app.get<{ Params: { address: string } }>(
    '/api/whale/wallets/:address',
    async (request, reply) => {
      try {
        const { address } = request.params;
        const query = walletQuerySchema.parse({
          ...request.query,
          address,
        });

        if (!whaleTracker) {
          return reply.status(503).send({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Whale tracker not configured',
            },
          });
        }

        // Fetch wallet info and transactions
        const [walletInfo, transactions] = await Promise.all([
          whaleTracker.classifyWallet(query.address),
          whaleTracker.fetchWalletTransactions(
            query.address,
            query.blockchain,
            query.limit
          ),
        ]);

        return reply.send({
          data: {
            wallet: walletInfo,
            transactions,
            stats: {
              totalTransactions: transactions.length,
              totalVolume: transactions.reduce((sum, tx) => sum + tx.amountUSD, 0),
              largestTransaction: Math.max(
                ...transactions.map((tx) => tx.amountUSD),
                0
              ),
            },
          },
        });
      } catch (error) {
        logger.error('Failed to fetch wallet activity', { error });
        return reply.status(400).send({
          error: {
            code: 'INVALID_REQUEST',
            message: error instanceof Error ? error.message : 'Invalid request',
          },
        });
      }
    }
  );

  // GET /api/whale/analysis/:symbol - Get whale analysis for symbol
  app.get<{ Params: { symbol: string } }>(
    '/api/whale/analysis/:symbol',
    async (request, reply) => {
      try {
        const { symbol } = request.params;
        const query = whaleAnalysisQuerySchema.parse({
          ...request.query,
          symbol,
        });

        if (!whaleTracker) {
          return reply.status(503).send({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Whale tracker not configured',
            },
          });
        }

        // Fetch whale activities and analyze
        const activities = await whaleTracker.fetchWhaleAlertTransactions(
          query.symbol,
          undefined,
          100
        );

        const analysis = whaleTracker.analyzeActivity(activities);
        const exchangeFlow = await whaleTracker.getExchangeFlowAnalysis(
          query.symbol,
          query.timeWindow
        );

        // Get recent events from database
        let recentEvents = [];
        if (repository) {
          recentEvents = await repository.findBySymbol(query.symbol, 20);
        }

        return reply.send({
          data: {
            symbol: query.symbol,
            analysis: {
              score: analysis.score,
              significance: analysis.significance,
              summary: analysis.summary,
            },
            exchangeFlow: {
              totalInflow: exchangeFlow.totalInflow,
              totalOutflow: exchangeFlow.totalOutflow,
              netFlow: exchangeFlow.netFlow,
              inflowCount: exchangeFlow.inflowCount,
              outflowCount: exchangeFlow.outflowCount,
              sentiment: exchangeFlow.sentiment,
            },
            recentActivity: activities.slice(0, 10),
            recentEvents,
            timeWindow: query.timeWindow,
          },
        });
      } catch (error) {
        logger.error('Failed to analyze whale activity', { error });
        return reply.status(400).send({
          error: {
            code: 'INVALID_REQUEST',
            message: error instanceof Error ? error.message : 'Invalid request',
          },
        });
      }
    }
  );

  // GET /api/whale/accumulation - Detect accumulation patterns
  app.get('/api/whale/accumulation', async (request, reply) => {
    try {
      const query = accumulationQuerySchema.parse(request.query);

      if (!whaleTracker) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Whale tracker not configured',
          },
        });
      }

      const pattern = await whaleTracker.detectAccumulationPattern(
        query.address,
        query.symbol,
        query.timeWindow
      );

      if (!pattern) {
        return reply.send({
          data: null,
          message: 'No accumulation pattern detected',
        });
      }

      return reply.send({
        data: pattern,
      });
    } catch (error) {
      logger.error('Failed to detect accumulation pattern', { error });
      return reply.status(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid request',
        },
      });
    }
  });

  // GET /api/whale/distribution - Detect distribution patterns
  app.get('/api/whale/distribution', async (request, reply) => {
    try {
      const query = accumulationQuerySchema.parse(request.query);

      if (!whaleTracker) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Whale tracker not configured',
          },
        });
      }

      const pattern = await whaleTracker.detectDistributionPattern(
        query.address,
        query.symbol,
        query.timeWindow
      );

      if (!pattern) {
        return reply.send({
          data: null,
          message: 'No distribution pattern detected',
        });
      }

      return reply.send({
        data: pattern,
      });
    } catch (error) {
      logger.error('Failed to detect distribution pattern', { error });
      return reply.status(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid request',
        },
      });
    }
  });

  // GET /api/whale/exchange-flow/:symbol - Get exchange flow analysis
  app.get<{ Params: { symbol: string } }>(
    '/api/whale/exchange-flow/:symbol',
    async (request, reply) => {
      try {
        const { symbol } = request.params;
        const query = exchangeFlowQuerySchema.parse({
          ...request.query,
          symbol,
        });

        if (!whaleTracker) {
          return reply.status(503).send({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Whale tracker not configured',
            },
          });
        }

        const analysis = await whaleTracker.getExchangeFlowAnalysis(
          query.symbol,
          query.timeWindow
        );

        return reply.send({
          data: {
            symbol: query.symbol,
            timeWindow: query.timeWindow,
            ...analysis,
          },
        });
      } catch (error) {
        logger.error('Failed to analyze exchange flow', { error });
        return reply.status(400).send({
          error: {
            code: 'INVALID_REQUEST',
            message: error instanceof Error ? error.message : 'Invalid request',
          },
        });
      }
    }
  );

  // GET /api/whale/stablecoin-flows - Get stablecoin flow analysis
  app.get('/api/whale/stablecoin-flows', async (request, reply) => {
    try {
      const query = z
        .object({
          timeWindow: z.coerce.number().int().positive().max(168).default(24),
        })
        .parse(request.query);

      if (!whaleTracker) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Whale tracker not configured',
          },
        });
      }

      const flows = await whaleTracker.getStablecoinFlows(query.timeWindow);

      return reply.send({
        data: {
          timeWindow: query.timeWindow,
          ...flows,
        },
      });
    } catch (error) {
      logger.error('Failed to analyze stablecoin flows', { error });
      return reply.status(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid request',
        },
      });
    }
  });

  logger.info('Whale routes registered');
}
