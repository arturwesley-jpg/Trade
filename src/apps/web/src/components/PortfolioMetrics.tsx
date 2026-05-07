/**
 * Portfolio Metrics Component
 * Displays real-time portfolio performance with visual indicators
 */

import { memo } from "react";
import { motion } from "framer-motion";

interface PortfolioMetricsProps {
  totalValue: number;
  totalPnL: number;
  pnlPercentage: number;
  openPositions: number;
}

export const PortfolioMetrics = memo(function PortfolioMetrics({
  totalValue,
  totalPnL,
  pnlPercentage,
  openPositions
}: PortfolioMetricsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const getPnLColor = (value: number) => {
    if (value > 0) return "var(--positive)";
    if (value < 0) return "var(--negative)";
    return "var(--muted)";
  };

  return (
    <div className="portfolio-metrics">
      <motion.div
        className="metric-item"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <span className="metric-label">Portfolio Value</span>
        <span className="metric-value">{formatCurrency(totalValue)}</span>
      </motion.div>

      <motion.div
        className="metric-item"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <span className="metric-label">Total PnL</span>
        <span className="metric-value" style={{ color: getPnLColor(totalPnL) }}>
          {formatCurrency(totalPnL)}
        </span>
      </motion.div>

      <motion.div
        className="metric-item"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <span className="metric-label">PnL %</span>
        <span className="metric-value" style={{ color: getPnLColor(pnlPercentage) }}>
          {formatPercentage(pnlPercentage)}
        </span>
      </motion.div>

      <motion.div
        className="metric-item"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <span className="metric-label">Open Positions</span>
        <span className="metric-value">{openPositions}</span>
      </motion.div>
    </div>
  );
});
