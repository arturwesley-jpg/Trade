import { motion } from "framer-motion";
import type { Position } from "../shared-types.js";
import { formatCurrency } from "../view-model.js";

export interface PositionsTableProps {
  positions: Position[];
}

export function PositionsTable({ positions }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <section className="panel positions-table-panel">
        <div className="panel-heading">
          <span className="eyebrow">Posições Ativas</span>
          <h2>Exposição Atual</h2>
        </div>
        <p className="empty">Nenhuma posição paper aberta.</p>
      </section>
    );
  }

  return (
    <section className="panel positions-table-panel">
      <div className="panel-heading">
        <span className="eyebrow">Posições Ativas</span>
        <h2>Exposição Atual ({positions.length})</h2>
      </div>
      <div className="table-wrapper">
        <table className="enhanced-table">
          <thead>
            <tr>
              <th>Ativo</th>
              <th>Lado</th>
              <th>Status</th>
              <th>Entrada</th>
              <th>Stop Loss</th>
              <th>Take Profit</th>
              <th>Margem</th>
              <th>Alavancagem</th>
              <th>P&L Não Realizado</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position, index) => {
              const unrealizedPnl = calculateUnrealizedPnL(position);
              const pnlClass = unrealizedPnl >= 0 ? "positive" : "negative";

              return (
                <motion.tr
                  key={position.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <td className="symbol-cell">{position.symbol}</td>
                  <td>
                    <span className={`badge ${position.side.toLowerCase()}`}>{position.side}</span>
                  </td>
                  <td>
                    <span className={`badge ${position.status.toLowerCase()}`}>{position.status}</span>
                  </td>
                  <td>{formatCurrency(position.entryPrice)}</td>
                  <td className="negative">{formatCurrency(position.stopLossPrice ?? 0)}</td>
                  <td className="positive">{formatCurrency(position.takeProfitPrice ?? 0)}</td>
                  <td>{formatCurrency(position.marginUsdt ?? 0)}</td>
                  <td>
                    <span className="leverage-badge">{position.leverage ?? 1}x</span>
                  </td>
                  <td className={pnlClass}>
                    <strong>{formatCurrency(unrealizedPnl)}</strong>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function calculateUnrealizedPnL(position: Position): number {
  // Simplified P&L calculation (would need current price for accurate calculation)
  // This is a placeholder - in real implementation, you'd get current price from market data
  const estimatedCurrentPrice = position.entryPrice * 1.02; // Assume 2% gain for demo
  const priceDiff = estimatedCurrentPrice - position.entryPrice;
  const positionSize = (position.marginUsdt ?? 0) * (position.leverage ?? 1);
  return (priceDiff / position.entryPrice) * positionSize;
}
