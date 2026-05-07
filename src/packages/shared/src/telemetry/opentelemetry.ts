/**
 * OpenTelemetry Integration
 * Distributed tracing and APM for the trading platform
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode, type Span } from '@opentelemetry/api';

export interface TelemetryOptions {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  otlpEndpoint?: string;
  enableMetrics?: boolean;
  enableTracing?: boolean;
}

export class TelemetryManager {
  private sdk: NodeSDK | null = null;
  private tracer: any;

  constructor(private options: TelemetryOptions) {}

  /**
   * Initialize OpenTelemetry SDK
   */
  initialize(): void {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.options.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.options.serviceVersion ?? '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.options.environment ?? 'production'
    });

    const otlpEndpoint = this.options.otlpEndpoint ?? 'http://localhost:4318';

    // Configure trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${otlpEndpoint}/v1/traces`,
      headers: {}
    });

    // Configure metric exporter
    const metricExporter = new OTLPMetricExporter({
      url: `${otlpEndpoint}/v1/metrics`,
      headers: {}
    });

    this.sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false // Disable file system instrumentation for performance
          },
          '@opentelemetry/instrumentation-http': {
            enabled: this.options.enableTracing !== false
          },
          '@opentelemetry/instrumentation-express': {
            enabled: this.options.enableTracing !== false
          },
          '@opentelemetry/instrumentation-pg': {
            enabled: this.options.enableTracing !== false
          },
          '@opentelemetry/instrumentation-redis': {
            enabled: this.options.enableTracing !== false
          }
        })
      ]
    });

    this.sdk.start();
    this.tracer = trace.getTracer(this.options.serviceName);

    console.log(`OpenTelemetry initialized for ${this.options.serviceName}`);
  }

  /**
   * Shutdown OpenTelemetry SDK
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log('OpenTelemetry shut down');
    }
  }

  /**
   * Create a new span
   */
  startSpan(name: string, attributes?: Record<string, any>): Span {
    return this.tracer.startSpan(name, {
      attributes
    });
  }

  /**
   * Execute function with tracing
   */
  async traceAsync<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, any>
  ): Promise<T> {
    const span = this.startSpan(name, attributes);

    try {
      const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Execute synchronous function with tracing
   */
  traceSync<T>(
    name: string,
    fn: (span: Span) => T,
    attributes?: Record<string, any>
  ): T {
    const span = this.startSpan(name, attributes);

    try {
      const result = context.with(trace.setSpan(context.active(), span), () => fn(span));
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Add event to current span
   */
  addEvent(name: string, attributes?: Record<string, any>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Set attribute on current span
   */
  setAttribute(key: string, value: any): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute(key, value);
    }
  }

  /**
   * Record exception on current span
   */
  recordException(error: Error): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
    }
  }
}

/**
 * Decorator for tracing methods
 */
export function Trace(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const traceName = operationName ?? `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const tracer = trace.getTracer('trading-platform');
      const span = tracer.startSpan(traceName);

      try {
        const result = await context.with(
          trace.setSpan(context.active(), span),
          () => originalMethod.apply(this, args)
        );
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}

/**
 * Create Fastify plugin for tracing
 */
export function createTracingPlugin(telemetry: TelemetryManager) {
  return async (fastify: any) => {
    fastify.addHook('onRequest', async (request: any) => {
      const span = telemetry.startSpan(`HTTP ${request.method} ${request.url}`, {
        'http.method': request.method,
        'http.url': request.url,
        'http.route': request.routeOptions?.url ?? request.url,
        'http.user_agent': request.headers['user-agent']
      });

      request.span = span;
    });

    fastify.addHook('onResponse', async (request: any, reply: any) => {
      if (request.span) {
        request.span.setAttribute('http.status_code', reply.statusCode);
        request.span.setStatus({
          code: reply.statusCode >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.OK
        });
        request.span.end();
      }
    });

    fastify.addHook('onError', async (request: any, reply: any, error: Error) => {
      if (request.span) {
        request.span.recordException(error);
        request.span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
      }
    });
  };
}

/**
 * Singleton instance
 */
let telemetryInstance: TelemetryManager | null = null;

/**
 * Get or create telemetry instance
 */
export function getTelemetry(options?: TelemetryOptions): TelemetryManager {
  if (!telemetryInstance && options) {
    telemetryInstance = new TelemetryManager(options);
    telemetryInstance.initialize();
  }

  if (!telemetryInstance) {
    throw new Error('Telemetry not initialized. Call getTelemetry with options first.');
  }

  return telemetryInstance;
}
