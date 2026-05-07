/**
 * Signal Card Component
 * Displays trading signal with confidence indicator and actionable insights
 */

import { memo } from "react";
import { motion } from "framer-motion";

interface Signal {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  confidence: number;
  status: string;
  reason?: string;
  rationale?: string;
  spreadPct?: number;
  sources?: string[];
}

interface SignalCardProps {
  signal: Signal;
  index: number;
}

export const SignalCard = memo(function SignalCard({ signal, index }: SignalCardProps) {
  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case "LONG":
        return "var(--positive)";
      case "SHORT":
        return "var(--negative)";
      default:
        return "var(--muted)";
    }
  };

  const getConfidenceLevel = (confidence: number) => {
    if (confidence >= 80) return { label: "High", color: "var(--positive)" };
    if (confidence >= 60) return { label: "Medium", color: "var(--warning)" };
    return { label: "Low", color: "var(--negative)" };
  };

  const confidenceLevel = getConfidenceLevel(signal.confidence);

  return (
    <motion.div
      className="signal-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      style={{
        borderLeft: `3px solid ${getDirectionColor(signal.direction)}`
      }}
    >
      <div className="signal-header">
        <div className="signal-symbol">
          <span className="symbol-text">{signal.symbol}</span>
          <span
            className="direction-badge"
            style={{ backgroundColor: getDirectionColor(signal.direction) }}
          >
            {signal.direction}
          </span>
        </div>
        <div className="signal-status">
          <span className="status-dot" />
          {signal.status}
        </div>
      </div>

      <div className="signal-confidence">
        <div className="confidence-label">
          <span>Confidence</span>
          <span style={{ color: confidenceLevel.color, fontWeight: 700 }}>
            {confidenceLevel.label}
          </span>
        </div>
        <div className="confidence-bar">
          <motion.div
            className="confidence-fill"
            initial={{ width: 0 }}
            animate={{ width: `${signal.confidence}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{ backgroundColor: confidenceLevel.color }}
          />
        </div>
        <div className="confidence-value">{signal.confidence}%</div>
      </div>

      {(signal.reason || signal.rationale) && (
        <div className="signal-rationale">
          <p>{signal.reason || signal.rationale}</p>
        </div>
      )}

      {signal.spreadPct !== undefined && (
        <div className="signal-spread">
          <span className="spread-label">Spread:</span>
          <span className="spread-value">{signal.spreadPct.toFixed(3)}%</span>
        </div>
      )}

      {signal.sources && signal.sources.length > 0 && (
        <div className="signal-sources">
          <span className="sources-label">Sources:</span>
          <div className="sources-list">
            {signal.sources.map((source, idx) => (
              <span key={idx} className="source-tag">
                {source}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
});
