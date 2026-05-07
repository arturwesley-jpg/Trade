/**
 * Sentry Integration for Error Tracking
 * Comprehensive error tracking and performance monitoring
 */

import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import type { FastifyRequest, FastifyReply } from 'fastify';

export interface SentryOptions {
  dsn: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
  enabled?: boolean;
}

export class SentryManager {
  private initialized = false;

  constructor(private options: SentryOptions) {}

  /**
   * Initialize Sentry
   */
  initialize(): void {
    if (this.initialized || !this.options.enabled) {
      return;
    }

    Sentry.init({
      dsn: this.options.dsn,
      environment: this.options.environment ?? 'production',
      release: this.options.release,
      tracesSampleRate: this.options.tracesSampleRate ?? 0.1,
      profilesSampleRate: this.options.profilesSampleRate ?? 0.1,
      integrations: [
        new ProfilingIntegration(),
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app: undefined }),
        new Sentry.Integrations.Postgres()
      ],
      beforeSend(event, hint) {
        // Filter out sensitive data
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
        return event;
      }
    });

    this.initialized = true;
    console.log('Sentry initialized');
  }

  /**
   * Capture exception
   */
  captureException(error: Error, context?: Record<string, any>): string {
    if (!this.initialized) return '';

    return Sentry.captureException(error, {
      extra: context
    });
  }

  /**
   * Capture message
   */
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>): string {
    if (!this.initialized) return '';

    return Sentry.captureMessage(message, {
      level,
      extra: context
    });
  }

  /**
   * Set user context
   */
  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.initialized) return;
    Sentry.setUser(user);
  }

  /**
   * Set tag
   */
  setTag(key: string, value: string): void {
    if (!this.initialized) return;
    Sentry.setTag(key, value);
  }

  /**
   * Set context
   */
  setContext(name: string, context: Record<string, any>): void {
    if (!this.initialized) return;
    Sentry.setContext(name, context);
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    if (!this.initialized) return;
    Sentry.addBreadcrumb(breadcrumb);
  }

  /**
   * Start transaction
   */
  startTransaction(name: string, op: string): Sentry.Transaction {
    return Sentry.startTransaction({ name, op });
  }

  /**
   * Flush events
   */
  async flush(timeout = 2000): Promise<boolean> {
    if (!this.initialized) return true;
    return Sentry.flush(timeout);
  }

  /**
   * Close Sentry
   */
  async close(timeout = 2000): Promise<boolean> {
    if (!this.initialized) return true;
    return Sentry.close(timeout);
  }
}

/**
 * Create Fastify plugin for Sentry
 */
export function createSentryPlugin(sentry: SentryManager) {
  return async (fastify: any) => {
    // Request handler
    fastify.addHook('onRequest', async (request: FastifyRequest) => {
      const transaction = sentry.startTransaction(
        `${request.method} ${request.routeOptions?.url ?? request.url}`,
        'http.server'
      );

      (request as any).sentryTransaction = transaction;

      sentry.addBreadcrumb({
        category: 'http',
        message: `${request.method} ${request.url}`,
        level: 'info',
        data: {
          method: request.method,
          url: request.url,
          headers: request.headers
        }
      });
    });

    // Response handler
    fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      const transaction = (request as any).sentryTransaction;
      if (transaction) {
        transaction.setHttpStatus(reply.statusCode);
        transaction.finish();
      }
    });

    // Error handler
    fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
      const transaction = (request as any).sentryTransaction;
      if (transaction) {
        transaction.setHttpStatus(reply.statusCode);
        transaction.finish();
      }

      sentry.captureException(error, {
        request: {
          method: request.method,
          url: request.url,
          headers: request.headers,
          query: request.query,
          body: request.body
        },
        user: (request as any).user
      });
    });
  };
}

/**
 * Singleton instance
 */
let sentryInstance: SentryManager | null = null;

/**
 * Get or create Sentry instance
 */
export function getSentry(options?: SentryOptions): SentryManager {
  if (!sentryInstance && options) {
    sentryInstance = new SentryManager(options);
    sentryInstance.initialize();
  }

  if (!sentryInstance) {
    throw new Error('Sentry not initialized. Call getSentry with options first.');
  }

  return sentryInstance;
}
