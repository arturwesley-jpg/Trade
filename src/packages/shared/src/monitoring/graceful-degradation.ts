/**
 * Graceful Degradation Utilities
 * Implements fallback strategies when services are degraded
 */

export interface DegradationStrategy {
  name: string;
  check: () => Promise<boolean>;
  fallback: () => Promise<any>;
}

/**
 * Circuit breaker for service calls
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private resetTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        if (fallback) {
          return fallback();
        }
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await Promise.race([
        operation(),
        this.timeoutPromise()
      ]);

      if (this.state === 'half-open') {
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();

      if (fallback) {
        return fallback();
      }

      throw error;
    }
  }

  private recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      console.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  private reset() {
    this.failures = 0;
    this.state = 'closed';
    console.log('Circuit breaker reset to closed state');
  }

  private timeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), this.timeout);
    });
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Cache with TTL for degraded service responses
 */
export class DegradationCache<T> {
  private cache = new Map<string, { value: T; expiry: number }>();

  set(key: string, value: T, ttl: number = 300000) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear() {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Service degradation manager
 */
export class DegradationManager {
  private strategies = new Map<string, DegradationStrategy>();
  private cache = new DegradationCache<any>();
  private circuitBreakers = new Map<string, CircuitBreaker>();

  registerStrategy(strategy: DegradationStrategy) {
    this.strategies.set(strategy.name, strategy);
  }

  getCircuitBreaker(name: string): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, new CircuitBreaker());
    }
    return this.circuitBreakers.get(name)!;
  }

  async executeWithFallback<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
    cacheKey?: string
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(serviceName);

    try {
      const result = await breaker.execute(operation, fallback);

      // Cache successful result
      if (cacheKey) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      // Try cache
      if (cacheKey && this.cache.has(cacheKey)) {
        console.warn(`Using cached data for ${serviceName}`);
        return this.cache.get(cacheKey)!;
      }

      // Try registered fallback strategy
      const strategy = this.strategies.get(serviceName);
      if (strategy) {
        console.warn(`Using fallback strategy for ${serviceName}`);
        return strategy.fallback();
      }

      throw error;
    }
  }

  getStatus() {
    const breakers: Record<string, any> = {};

    this.circuitBreakers.forEach((breaker, name) => {
      breakers[name] = breaker.getState();
    });

    return {
      strategies: Array.from(this.strategies.keys()),
      circuitBreakers: breakers,
      cacheSize: this.cache.size()
    };
  }
}

// Singleton instance
export const degradationManager = new DegradationManager();
