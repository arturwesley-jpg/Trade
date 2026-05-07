/**
 * Structured Logging with Pino
 * Production-ready logging system with levels, context, and structured output
 */

import pino from "pino";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LoggerOptions {
  level?: LogLevel;
  name?: string;
  prettyPrint?: boolean;
  redact?: string[];
}

export interface LogContext {
  [key: string]: unknown;
  requestId?: string;
  userId?: string;
  symbol?: string;
  provider?: string;
  duration?: number;
  error?: Error | string;
}

/**
 * Create a structured logger instance
 */
export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const isDevelopment = process.env.NODE_ENV !== "production";
  
  return pino({
    level: options.level ?? (isDevelopment ? "debug" : "info"),
    name: options.name ?? "trade-app",
    redact: options.redact ?? ["password", "token", "apiKey", "secret"],
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        name: bindings.name
      })
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(options.prettyPrint && isDevelopment
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss.l",
              ignore: "pid,hostname"
            }
          }
        }
      : {})
  });
}

/**
 * Logger class wrapper for compatibility
 */
class Logger {
  private pinoLogger: pino.Logger;

  constructor(options: LoggerOptions = {}) {
    this.pinoLogger = createLogger(options);
  }

  setContext(context: LogContext): void {
    this.pinoLogger = this.pinoLogger.child(context);
  }

  trace(message: string, context?: LogContext): void;
  trace(context: LogContext, message?: string): void;
  trace(arg1: string | LogContext, arg2?: string | LogContext): void {
    if (typeof arg1 === 'string') {
      this.pinoLogger.trace(arg2 as LogContext || {}, arg1);
    } else {
      this.pinoLogger.trace(arg1, arg2 as string || '');
    }
  }

  debug(message: string, context?: LogContext): void;
  debug(context: LogContext, message?: string): void;
  debug(arg1: string | LogContext, arg2?: string | LogContext): void {
    if (typeof arg1 === 'string') {
      this.pinoLogger.debug(arg2 as LogContext || {}, arg1);
    } else {
      this.pinoLogger.debug(arg1, arg2 as string || '');
    }
  }

  info(message: string, context?: LogContext): void;
  info(context: LogContext, message?: string): void;
  info(arg1: string | LogContext, arg2?: string | LogContext): void {
    if (typeof arg1 === 'string') {
      this.pinoLogger.info(arg2 as LogContext || {}, arg1);
    } else {
      this.pinoLogger.info(arg1, arg2 as string || '');
    }
  }

  warn(message: string, context?: LogContext): void;
  warn(context: LogContext, message?: string): void;
  warn(arg1: string | LogContext, arg2?: string | LogContext): void {
    if (typeof arg1 === 'string') {
      this.pinoLogger.warn(arg2 as LogContext || {}, arg1);
    } else {
      this.pinoLogger.warn(arg1, arg2 as string || '');
    }
  }

  error(message: string, context?: LogContext): void;
  error(context: LogContext, message?: string): void;
  error(arg1: string | LogContext, arg2?: string | LogContext): void {
    if (typeof arg1 === 'string') {
      this.pinoLogger.error(arg2 as LogContext || {}, arg1);
    } else {
      this.pinoLogger.error(arg1, arg2 as string || '');
    }
  }

  fatal(message: string, context?: LogContext): void;
  fatal(context: LogContext, message?: string): void;
  fatal(arg1: string | LogContext, arg2?: string | LogContext): void {
    if (typeof arg1 === 'string') {
      this.pinoLogger.fatal(arg2 as LogContext || {}, arg1);
    } else {
      this.pinoLogger.fatal(arg1, arg2 as string || '');
    }
  }
}

/**
 * Default application logger
 */
export const logger = new Logger({ name: "trade-app", prettyPrint: true });

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: LogContext, parentLogger?: Logger | pino.Logger): pino.Logger {
  if (parentLogger instanceof Logger) {
    return parentLogger['pinoLogger'].child(context);
  }
  return (parentLogger || logger['pinoLogger']).child(context);
}

/**
 * Log an error with full context
 */
export function logError(error: Error | string, context: LogContext = {}, loggerInstance = logger): void {
  const errorObj = error instanceof Error ? error : new Error(error);
  loggerInstance.error(
    {
      ...context,
      err: {
        message: errorObj.message,
        stack: errorObj.stack,
        name: errorObj.name
      }
    },
    errorObj.message
  );
}

/**
 * Log a performance metric
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  context: LogContext = {},
  loggerInstance = logger
): void {
  loggerInstance.info(
    {
      ...context,
      operation,
      duration: durationMs,
      metric: "performance"
    },
    `${operation} completed in ${durationMs}ms`
  );
}

/**
 * Log an audit event
 */
export function logAudit(
  action: string,
  userId: string,
  context: LogContext = {},
  loggerInstance = logger
): void {
  loggerInstance.info(
    {
      ...context,
      userId,
      action,
      metric: "audit"
    },
    `Audit: ${action} by user ${userId}`
  );
}

/**
 * Express middleware for request logging
 */
export function requestLogger(loggerInstance = logger) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const requestId = req.headers["x-request-id"] ?? `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    req.log = createChildLogger({ requestId }, loggerInstance);
    
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      req.log.info(
        {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          userAgent: req.headers["user-agent"],
          ip: req.ip
        },
        `${req.method} ${req.url} ${res.statusCode} - ${duration}ms`
      );
    });
    
    next();
  };
}
