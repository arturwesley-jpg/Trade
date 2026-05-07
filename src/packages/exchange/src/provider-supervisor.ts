export interface ProviderSupervisorOptions {
  providers: string[];
  primaryProvider: string;
  staleAfterMs: number;
  now?: () => number;
}

export interface ProviderTickInput {
  price: number;
  latencyMs: number;
  timestamp: number;
}

export interface ProviderHealth {
  provider: string;
  healthy: boolean;
  stale: boolean;
  price: number | null;
  latencyMs: number | null;
  updatedAt: number | null;
  lastError?: string;
}

export interface ProviderSupervisorStatus {
  recommendedProvider: string | null;
  failoverOrder: string[];
  providers: Record<string, ProviderHealth>;
  dataQualityScore: number;
  disagreementScore: number;
  shouldEmitWait: boolean;
}

export class ProviderSupervisor {
  private readonly providers = new Map<string, ProviderHealth>();
  private readonly now: () => number;

  constructor(private readonly options: ProviderSupervisorOptions) {
    this.now = options.now ?? Date.now;
    for (const provider of options.providers) {
      this.providers.set(provider, {
        provider,
        healthy: false,
        stale: true,
        price: null,
        latencyMs: null,
        updatedAt: null
      });
    }
  }

  recordTick(provider: string, input: ProviderTickInput): void {
    this.ensureProvider(provider);
    this.providers.set(provider, {
      provider,
      healthy: true,
      stale: false,
      price: input.price,
      latencyMs: input.latencyMs,
      updatedAt: input.timestamp
    });
  }

  recordError(provider: string, message: string): void {
    const current = this.ensureProvider(provider);
    this.providers.set(provider, {
      ...current,
      healthy: false,
      lastError: message
    });
  }

  status(): ProviderSupervisorStatus {
    const providers = Object.fromEntries(
      [...this.providers.entries()].map(([name, health]) => [name, this.withFreshness(health)])
    );
    const healthy = Object.values(providers).filter((provider) => provider.healthy && !provider.stale);
    const failoverOrder = healthy
      .sort((left, right) => {
        if (left.provider === this.options.primaryProvider) return -1;
        if (right.provider === this.options.primaryProvider) return 1;
        return (left.latencyMs ?? Number.MAX_SAFE_INTEGER) - (right.latencyMs ?? Number.MAX_SAFE_INTEGER);
      })
      .map((provider) => provider.provider);
    const disagreementScore = calculateDisagreement(healthy.map((provider) => provider.price).filter(isNumber));
    const coverageScore = (healthy.length / Math.max(this.providers.size, 1)) * 100;
    const latencyPenalty = average(healthy.map((provider) => provider.latencyMs).filter(isNumber)) / 25;
    const dataQualityScore = clamp(coverageScore - disagreementScore * 4 - latencyPenalty, 0, 100);

    return {
      recommendedProvider: failoverOrder[0] ?? null,
      failoverOrder,
      providers,
      dataQualityScore: round(dataQualityScore),
      disagreementScore,
      shouldEmitWait: dataQualityScore < 70 || disagreementScore > 2
    };
  }

  private ensureProvider(provider: string): ProviderHealth {
    const current = this.providers.get(provider);
    if (current) return current;
    const created: ProviderHealth = {
      provider,
      healthy: false,
      stale: true,
      price: null,
      latencyMs: null,
      updatedAt: null
    };
    this.providers.set(provider, created);
    return created;
  }

  private withFreshness(health: ProviderHealth): ProviderHealth {
    const stale = health.updatedAt === null || this.now() - health.updatedAt > this.options.staleAfterMs;
    return {
      ...health,
      stale,
      healthy: health.healthy && !stale
    };
  }
}

function calculateDisagreement(prices: number[]): number {
  if (prices.length < 2) return prices.length === 1 ? 25 : 100;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const maxDistancePct = Math.max(...prices.map((price) => Math.abs(price - median) / Math.max(median, 1))) * 100;
  return round(maxDistancePct);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
