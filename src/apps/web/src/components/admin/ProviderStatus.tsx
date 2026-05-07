import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

export interface ProviderHealth {
  provider: "binance" | "bybit" | "okx" | "kraken" | "bingx";
  status: "healthy" | "degraded" | "down";
  latencyMs: number;
  lastUpdate: string;
  dataQuality: number;
  priceUsd?: number;
  errorCount: number;
}

export interface PriceConsensus {
  symbol: string;
  consensusPrice: number;
  priceRange: { min: number; max: number };
  disagreementPct: number;
  providers: Array<{ name: string; price: number }>;
}

interface ProviderStatusProps {
  providers: ProviderHealth[];
  consensus: PriceConsensus[];
  onRefresh?: () => void;
}

export function ProviderStatus({ providers, consensus, onRefresh }: ProviderStatusProps) {
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh || !onRefresh) return;
    const interval = setInterval(onRefresh, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  const healthyCount = providers.filter((p) => p.status === "healthy").length;
  const avgLatency = providers.reduce((sum, p) => sum + p.latencyMs, 0) / providers.length;
  const avgQuality = providers.reduce((sum, p) => sum + p.dataQuality, 0) / providers.length;

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div>
          <h2>Provider Status Dashboard</h2>
          <p>Real-time monitoring of all market data providers</p>
        </div>
        <div className="admin-actions">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (10s)
          </label>
          {onRefresh && (
            <button onClick={onRefresh} className="btn-secondary">
              Refresh Now
            </button>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Healthy Providers</span>
          <strong className="stat-value">{healthyCount}/{providers.length}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg Latency</span>
          <strong className="stat-value">{avgLatency.toFixed(0)}ms</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg Quality</span>
          <strong className="stat-value">{avgQuality.toFixed(1)}%</strong>
        </div>
      </div>

      <div className="provider-grid">
        {providers.map((provider) => (
          <ProviderCard key={provider.provider} provider={provider} />
        ))}
      </div>

      <div className="consensus-section">
        <h3>Price Consensus View</h3>
        {consensus.map((item) => (
          <ConsensusCard key={item.symbol} consensus={item} />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderHealth }) {
  const statusColor = {
    healthy: "#10b981",
    degraded: "#f59e0b",
    down: "#ef4444"
  }[provider.status];

  const statusIcon = {
    healthy: "●",
    degraded: "◐",
    down: "○"
  }[provider.status];

  return (
    <div className="provider-card">
      <div className="provider-header">
        <h4>{provider.provider.toUpperCase()}</h4>
        <span className="status-indicator" style={{ color: statusColor }}>
          {statusIcon} {provider.status}
        </span>
      </div>

      <div className="provider-metrics">
        <div className="metric">
          <span>Latency</span>
          <strong className={provider.latencyMs > 500 ? "text-warning" : ""}>
            {provider.latencyMs}ms
          </strong>
        </div>
        <div className="metric">
          <span>Quality</span>
          <strong>{provider.dataQuality.toFixed(1)}%</strong>
        </div>
        <div className="metric">
          <span>Errors</span>
          <strong className={provider.errorCount > 0 ? "text-danger" : ""}>
            {provider.errorCount}
          </strong>
        </div>
      </div>

      {provider.priceUsd && (
        <div className="provider-price">
          ${provider.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      )}

      <div className="provider-footer">
        <small>Last update: {new Date(provider.lastUpdate).toLocaleTimeString()}</small>
      </div>
    </div>
  );
}

function ConsensusCard({ consensus }: { consensus: PriceConsensus }) {
  const hasDisagreement = consensus.disagreementPct > 0.5;

  return (
    <div className={`consensus-card ${hasDisagreement ? "has-alert" : ""}`}>
      <div className="consensus-header">
        <h4>{consensus.symbol}</h4>
        <div className="consensus-price">
          ${consensus.consensusPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      <div className="consensus-range">
        <span>Range: ${consensus.priceRange.min.toFixed(2)} - ${consensus.priceRange.max.toFixed(2)}</span>
        {hasDisagreement && (
          <span className="disagreement-alert">
            ⚠ {consensus.disagreementPct.toFixed(2)}% disagreement
          </span>
        )}
      </div>

      <div className="provider-prices">
        {consensus.providers.map((p) => (
          <div key={p.name} className="provider-price-item">
            <span>{p.name}</span>
            <strong>${p.price.toFixed(2)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
