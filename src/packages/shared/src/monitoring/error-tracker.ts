/**
 * Error Tracking Service
 * Captures and reports frontend and backend errors
 */

export interface ErrorReport {
  id: string;
  timestamp: number;
  message: string;
  stack?: string;
  context: 'frontend' | 'backend';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
  userAgent?: string;
  url?: string;
  userId?: string;
}

export class ErrorTracker {
  private errors: ErrorReport[] = [];
  private maxErrors = 1000;
  private listeners: Array<(error: ErrorReport) => void> = [];

  /**
   * Capture an error
   */
  captureError(
    error: Error | string,
    context: 'frontend' | 'backend',
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    metadata?: Record<string, any>
  ): ErrorReport {
    const errorReport: ErrorReport = {
      id: `error-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
      context,
      severity,
      metadata,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    };

    this.errors.push(errorReport);

    // Trim old errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(errorReport));

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${context}] ${severity}:`, errorReport.message, metadata);
    }

    return errorReport;
  }

  /**
   * Capture exception with automatic severity detection
   */
  captureException(
    error: Error,
    context: 'frontend' | 'backend',
    metadata?: Record<string, any>
  ): ErrorReport {
    // Determine severity based on error type
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      severity = 'high';
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      severity = 'medium';
    } else if (error.message.includes('database') || error.message.includes('auth')) {
      severity = 'critical';
    }

    return this.captureError(error, context, severity, metadata);
  }

  /**
   * Get all errors
   */
  getErrors(options?: {
    context?: 'frontend' | 'backend';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    since?: number;
  }): ErrorReport[] {
    let filtered = [...this.errors];

    if (options?.context) {
      filtered = filtered.filter(e => e.context === options.context);
    }

    if (options?.severity) {
      filtered = filtered.filter(e => e.severity === options.severity);
    }

    if (options?.since) {
      filtered = filtered.filter(e => e.timestamp >= options.since!);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get error statistics
   */
  getStats(since?: number): {
    total: number;
    byContext: Record<string, number>;
    bySeverity: Record<string, number>;
    recentErrors: ErrorReport[];
  } {
    const errors = since ? this.errors.filter(e => e.timestamp >= since) : this.errors;

    const byContext: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    errors.forEach(error => {
      byContext[error.context] = (byContext[error.context] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    });

    return {
      total: errors.length,
      byContext,
      bySeverity,
      recentErrors: errors.slice(-10).reverse()
    };
  }

  /**
   * Subscribe to error events
   */
  subscribe(listener: (error: ErrorReport) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.errors = [];
  }
}

// Singleton instance
export const errorTracker = new ErrorTracker();

/**
 * Setup global error handlers for frontend
 */
export function setupFrontendErrorTracking() {
  if (typeof window === 'undefined') return;

  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    errorTracker.captureException(event.error || new Error(event.message), 'frontend', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    errorTracker.captureException(error, 'frontend', {
      type: 'unhandledRejection'
    });
  });

  // Capture console errors
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    errorTracker.captureError(
      args.join(' '),
      'frontend',
      'low',
      { source: 'console.error' }
    );
    originalConsoleError.apply(console, args);
  };
}

/**
 * Setup global error handlers for backend
 */
export function setupBackendErrorTracking() {
  // Capture unhandled exceptions
  process.on('uncaughtException', (error) => {
    errorTracker.captureException(error, 'backend', {
      type: 'uncaughtException'
    });
    console.error('Uncaught Exception:', error);
  });

  // Capture unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error
      ? reason
      : new Error(String(reason));

    errorTracker.captureException(error, 'backend', {
      type: 'unhandledRejection'
    });
    console.error('Unhandled Rejection:', error);
  });
}
