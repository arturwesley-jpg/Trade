/**
 * Position Card Component
 * Displays individual position with TP/SL visualization and real-time PnL
 */

import { memo } from "react";
import { motion } from "framer-motion";

interface Position {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  marginUsdt: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  takeProfit?: number;
  stopLoss?: number;
  status: "OPEN" | "CLOSED";
}

interface PositionCardProps {
  position: Position;
  onClose?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export const PositionCard = memo(function PositionCard({
  position,
  onClose,
  onEdit
}: PositionCardProps) {
  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return "var(--positive)";
    if (pnl < 0) return "var(--negative)";
    return "var(--muted)";
  };

  const getSideColor = (side: string) => {
    return side === "LONG" ? "var(--positive)" : "var(--negative)";
  };

  const calculatePriceRange = () => {
    const prices = [
      position.entryPrice,
      position.currentPrice,
      position.takeProfit,
      position.stopLoss
    ].filter((p): p is number => p !== undefined);

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    const padding = range * 0.1;

    return { min: min - padding, max: max + padding, range: range + padding * 2 };
  };

  const getPositionOnScale = (price: number) => {
    const { min, range } = calculatePriceRange();
    return ((price - min) / range) * 100;
  };

  return (
    <motion.div
      className="position-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      style={{ borderLeft: `3px solid ${getSideColor(position.side)}` }}
    >
      <div className="position-header">
        <div className="position-symbol">
          <span className="symbol-text">{position.symbol}</span>
          <span
            className="side-badge"
            style={{ backgroundColor: getSideColor(position.side) }}
          >
            {position.side}
          </span>
          <span className="leverage-badge">{position.leverage}x</span>
        </div>

        <div className="position-actions">
          {onEdit && (
            <button
              className="position-action-btn"
              onClick={() => onEdit(position.id)}
              aria-label="Edit position"
              title="Edit"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          {onClose && (
            <button
              className="position-action-btn close"
              onClick={() => onClose(position.id)}
              aria-label="Close position"
              title="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="position-prices">
        <div className="price-item">
          <span className="price-label">Entry</span>
          <span className="price-value">${position.entryPrice.toLocaleString()}</span>
        </div>
        <div className="price-item">
          <span className="price-label">Current</span>
          <span className="price-value">${position.currentPrice.toLocaleString()}</span>
        </div>
        <div className="price-item">
          <span className="price-label">Size</span>
          <span className="price-value">{position.size.toFixed(4)}</span>
        </div>
      </div>

      {/* Price Scale Visualization */}
      <div className="position-scale">
        <div className="scale-track">
          {/* Take Profit */}
          {position.takeProfit && (
            <div
              className="scale-marker tp"
              style={{ left: `${getPositionOnScale(position.takeProfit)}%` }}
              title={`TP: $${position.takeProfit.toLocaleString()}`}
            >
              <div className="marker-line" />
              <div className="marker-label">TP</div>
            </div>
          )}

          {/* Entry Price */}
          <div
            className="scale-marker entry"
            style={{ left: `${getPositionOnScale(position.entryPrice)}%` }}
            title={`Entry: $${position.entryPrice.toLocaleString()}`}
          >
            <div className="marker-line" />
            <div className="marker-label">Entry</div>
          </div>

          {/* Current Price */}
          <motion.div
            className="scale-marker current"
            style={{ left: `${getPositionOnScale(position.currentPrice)}%` }}
            animate={{ left: `${getPositionOnScale(position.currentPrice)}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            title={`Current: $${position.currentPrice.toLocaleString()}`}
          >
            <div className="marker-line" />
            <div className="marker-label">Now</div>
          </motion.div>

          {/* Stop Loss */}
          {position.stopLoss && (
            <div
              className="scale-marker sl"
              style={{ left: `${getPositionOnScale(position.stopLoss)}%` }}
              title={`SL: $${position.stopLoss.toLocaleString()}`}
            >
              <div className="marker-line" />
              <div className="marker-label">SL</div>
            </div>
          )}
        </div>
      </div>

      {/* PnL Display */}
      <div className="position-pnl">
        <div className="pnl-item">
          <span className="pnl-label">Unrealized PnL</span>
          <span
            className="pnl-value"
            style={{ color: getPnLColor(position.unrealizedPnl) }}
          >
            ${position.unrealizedPnl.toFixed(2)}
          </span>
        </div>
        <div className="pnl-item">
          <span className="pnl-label">PnL %</span>
          <span
            className="pnl-value"
            style={{ color: getPnLColor(position.unrealizedPnlPct) }}
          >
            {position.unrealizedPnlPct > 0 ? "+" : ""}
            {position.unrealizedPnlPct.toFixed(2)}%
          </span>
        </div>
        <div className="pnl-item">
          <span className="pnl-label">Margin</span>
          <span className="pnl-value">${position.marginUsdt.toFixed(2)}</span>
        </div>
      </div>
    </motion.div>
  );
});
