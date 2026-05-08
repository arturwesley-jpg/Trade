import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { SentimentService } from '@trade/sentiment';

const sentimentQuerySchema = z.object({
  symbol: z.string(),
});

const newsQuerySchema = z.object({
  symbol: z.string().optional(),
  filter: z.enum(['rising', 'hot', 'bullish', 'bearish', 'important']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const fearGreedQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(365).default(30),
});

const batchSentimentSchema = z.object({
  symbols: z.array(z.string()).min(1).max(20),
});

export interface SentimentRoutesOptions {
  sentimentService?: SentimentService;
}

export function registerSentimentRoutes(
  app: FastifyInstance,
  options: SentimentRoutesOptions = {}
) {
  const { sentimentService } = options;

  // GET /api/sentiment/:symbol - Get aggregated sentiment for a symbol
  app.get<{ Params: { symbol: string } }>(
    '/api/sentiment/:symbol',
    async (request, reply) => {
      try {
        const params = sentimentQuerySchema.parse(request.params);

        if (!sentimentService) {
          return reply.status(503).send({
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Sentiment service not configured',
            },
          });
        }

        const sentiment = await sentimentService.getSentiment(params.symbol);

        return reply.send({
          data: sentiment,
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

  // POST /api/sentiment/batch - Get sentiment for multiple symbols
  app.post('/api/sentiment/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = batchSentimentSchema.parse(request.body);

      if (!sentimentService) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Sentiment service not configured',
          },
        });
      }

      const results = await sentimentService.getSentimentBatch(body.symbols);

      return reply.send({
        data: Object.fromEntries(results),
        count: results.size,
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

  // GET /api/sentiment/news - Get news articles
  app.get('/api/sentiment/news', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = newsQuerySchema.parse(request.query);

      if (!sentimentService) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Sentiment service not configured',
          },
        });
      }

      let news;
      if (query.filter === 'bullish') {
        news = await sentimentService.getBullishNews(
          query.symbol ? [query.symbol] : undefined,
          query.limit
        );
      } else if (query.filter === 'bearish') {
        news = await sentimentService.getBearishNews(
          query.symbol ? [query.symbol] : undefined,
          query.limit
        );
      } else if (query.symbol) {
        news = await sentimentService.getNews(query.symbol, query.limit);
      } else {
        return reply.status(400).send({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Either symbol or filter must be provided',
          },
        });
      }

      return reply.send({
        data: news,
        count: news.length,
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

  // GET /api/sentiment/fear-greed - Get current Fear & Greed Index
  app.get('/api/sentiment/fear-greed', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!sentimentService) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Sentiment service not configured',
          },
        });
      }

      const index = await sentimentService.getFearGreedIndex();

      if (!index) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Failed to fetch Fear & Greed Index',
          },
        });
      }

      return reply.send({
        data: index,
      });
    } catch (error) {
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      });
    }
  });

  // GET /api/sentiment/fear-greed/history - Get historical Fear & Greed Index
  app.get('/api/sentiment/fear-greed/history', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = fearGreedQuerySchema.parse(request.query);

      if (!sentimentService) {
        return reply.status(503).send({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Sentiment service not configured',
          },
        });
      }

      const history = await sentimentService.getHistoricalFearGreed(query.limit);

      return reply.send({
        data: history,
        count: history.length,
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
}
