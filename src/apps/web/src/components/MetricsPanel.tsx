import { useEffect, memo } from "react";
import { motion } from "framer-motion";
import { useTrading } from "../contexts/TradingContext.js";
import { LoadingSpinner } from "./LoadingSpinner.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { formatCurrency, formatPercent } from "../view-model.js";

export const MetricsPanel = memo(function MetricsPanel() {
  const { metrics, isLoading, error, refreshMetrics } = useTrading();

  useEffect(() => {
    void refreshMetrics();
  }, [refreshMetrics]);

  if (isLoading && !metrics) {
    return (
      <motion.div
        className="metrics-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="panel">
          <LoadingSpinner message="Carregando métricas..." />
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        className="metrics-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="panel">
          <ErrorMessage
            title="Erro ao carregar métricas"
            message={error}
            onRetry={refreshMetrics}
          />
        </div>
      </motion.div>
    );
  }

  if (!metrics) {
    return (
      <motion.div
        className="metrics-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="panel">
          <header className="panel-header">
            <h2>Métricas de Performance</h2>
            <button
              className="btn btn-secondary"
              onClick={() => void refreshMetrics()}
              disabled={isLoading}
              aria-label="Atualizar métricas"
            >
              {isLoading ? "Atualizando..." : "Atualizar"}
            </button>
          </header>
          <p className="empty" style={{ padding: "2rem", textAlign: "center" }}>
            Nenhuma métrica disponível. Execute alguns trades para ver as métricas.
          </p>
        </div>
      </motion.div>
    );
  }

  const metricsData = [
    {
      label: "Total Return",
      value: formatCurrency(metrics.totalReturn || 0),
      trend: (metrics.totalReturn || 0) >= 0 ? "positive" : "negative"
    },
    {
      label: "Win Rate",
      value: formatPercent(metrics.winRate || 0),
      trend: (metrics.winRate || 0) >= 50 ? "positive" : "negative"
    },
    {
      label: "Sharpe Ratio",
      value: (metrics.sharpeRatio || 0).toFixed(2),
      trend: (metrics.sharpeRatio || 0) >= 1 ? "positive" : "neutral"
    },
    {
      label: "Max Drawdown",
      value: formatPercent(metrics.maxDrawdownPct || 0),
      trend: (metrics.maxDrawdownPct || 0) <= -10 ? "negative" : "neutral"
    },
    {
      label: "Total Trades",
      value: metrics.totalTrades || 0,
      trend: "neutral"
    },
    {
      label: "Profit Factor",
      value: (metrics.profitFactor || 0).toFixed(2),
      trend: (metrics.profitFactor || 0) >= 1.5 ? "positive" : "neutral"
    }
  ];

  return (
    <motion.div
      className="metrics-panel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="panel">
        <header className="panel-header">
          <h2>Métricas de Performance</h2>
          <button
            className="btn btn-secondary"
            onClick={() => void refreshMetrics()}
            disabled={isLoading}
            aria-label="Atualizar métricas"
          >
            {isLoading ? "Atualizando..." : "Atualizar"}
          </button>
        </header>

        <div className="metrics-grid">
          {metricsData.map((metric, index) => (
            <motion.div
              key={metric.label}
              className={`metric-card ${metric.trend}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05, duration: 0.2 }}
            >
              <span className="metric-label">{metric.label}</span>
              <strong className="metric-value">{metric.value}</strong>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
});
