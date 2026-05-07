import { useMemo } from "react";
import type { Position } from "../../shared-types.js";

export interface PaperMetrics {
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  equityCurve: Array<{ timestamp: string; equity: number }>;
  tradesBySymbol: Record<string, number>;
}

interface PaperMetricsProps {
  metrics: PaperMetrics;
  recentTrades: Position[];
}

export function PaperMetrics({ metrics, recentTrades }: PaperMetricsProps) {
  const equityChange = useMemo(() => {
    if (metrics.equityCurve.length < 2) return 0;
    const first = metrics.equityCurve[0].equity;
    const last = metrics.equityCurve[metrics.equityCurve.length - 1].equity;
    return ((last - first) / first) * 100;
  }, [metrics.equityCurve]);

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <div>
          <h2>Paper Trading Metrics</h2>
          <p>Performance analysis and trade statistics</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card highlight">
          <span className="stat-label">Win Rate</span>
          <strong className="stat-value">{metrics.winRate.toFixed(1)}%</strong>
          <small>{metrics.winningTrades}W / {metrics.losingTrades}L</small>
        </div>
        <div className="stat-card">
          <span className="stat-label">Profit Factor</span>
          <strong className="stat-value">{metrics.profitFactor.toFixed(2)}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Sharpe Ratio</span>
          <strong className="stat-value">{metrics.sharpeRatio.toFixed(2)}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total PnL</span>
          <strong className={`stat-value ${metrics.totalPnl >= 0 ? "text-success" : "text-danger"}`}>
            ${metrics.totalPnl.toFixed(2)}
          </strong>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-panel">
          <h3>Equity Curve</h3>
          <EquityCurveChart data={metrics.equityCurve} />
          <div className="equity-stats">
            <span>Change: <strong className={equityChange >= 0 ? "text-success" : "text-danger"}>
              {equityChange >= 0 ? "+" : ""}{equityChange.toFixed(2)}%
            </strong></span>
          </div>
        </div>

        <div className="metric-panel">
          <h3>Drawdown Analysis</h3>
          <div className="drawdown-display">
            <div className="drawdown-bar" style={{ "--drawdown": `${metrics.maxDrawdownPct}%` } as React.CSSProperties}>
              <span>{metrics.maxDrawdownPct.toFixed(2)}%</span>
            </div>
          </div>
          <div className="metric-details">
            <div>
              <span>Max Drawdown</span>
              <strong className="text-danger">${metrics.maxDrawdown.toFixed(2)}</strong>
            </div>
            <div>
              <span>Max DD %</span>
              <strong className="text-danger">{metrics.maxDrawdownPct.toFixed(2)}%</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-panel">
          <h3>Trade Distribution by Symbol</h3>
          <div className="symbol-distribution">
            {Object.entries(metrics.tradesBySymbol).map(([symbol, count]) => (
              <div key={symbol} className="symbol-bar">
                <span>{symbol}</span>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{ width: `${(count / metrics.totalTrades) * 100}%` }}
                  />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="metric-panel">
          <h3>Win/Loss Statistics</h3>
          <div className="metric-details">
            <div>
              <span>Avg Win</span>
              <strong className="text-success">${metrics.avgWin.toFixed(2)}</strong>
            </div>
            <div>
              <span>Avg Loss</span>
              <strong className="text-danger">${metrics.avgLoss.toFixed(2)}</strong>
            </div>
            <div>
              <span>Largest Win</span>
              <strong className="text-success">${metrics.largestWin.toFixed(2)}</strong>
            </div>
            <div>
              <span>Largest Loss</span>
              <strong className="text-danger">${metrics.largestLoss.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="metric-panel">
        <h3>Recent Trades</h3>
        <div className="trades-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Side</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>PnL</th>
                <th>Opened</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.map((trade) => (
                <tr key={trade.id}>
                  <td>{trade.symbol}</td>
                  <td>{trade.side}</td>
                  <td>${trade.entryPrice.toFixed(2)}</td>
                  <td>{trade.exitPrice ? `$${trade.exitPrice.toFixed(2)}` : "-"}</td>
                  <td className={trade.pnlUsdt >= 0 ? "text-success" : "text-danger"}>
                    ${trade.pnlUsdt.toFixed(2)}
                  </td>
                  <td>{new Date(trade.openedAt).toLocaleString()}</td>
                  <td>{trade.closedAt ? new Date(trade.closedAt).toLocaleString() : "Open"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EquityCurveChart({ data }: { data: Array<{ timestamp: string; equity: number }> }) {
  if (data.length === 0) {
    return <div className="chart-empty">No equity data available</div>;
  }

  const maxEquity = Math.max(...data.map((d) => d.equity));
  const minEquity = Math.min(...data.map((d) => d.equity));
  const range = maxEquity - minEquity || 1;

  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((point.equity - minEquity) / range) * 100;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="equity-chart">
      <svg viewBox="0 0 100 50" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-primary, #3b82f6)"
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="chart-labels">
        <span>${minEquity.toFixed(0)}</span>
        <span>${maxEquity.toFixed(0)}</span>
      </div>
    </div>
  );
}
