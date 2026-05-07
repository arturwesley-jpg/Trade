import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { formatCurrency, formatPercent } from "../view-model.js";

export interface Trade {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  pnl: number;
  pnlPercent: number;
  marginUsdt: number;
  leverage: number;
  status: "WIN" | "LOSS" | "BREAKEVEN";
}

export interface TradesHistoryProps {
  trades: Trade[];
}

type FilterType = "all" | "wins" | "losses";
type SortField = "exitTime" | "pnl" | "pnlPercent";
type SortOrder = "asc" | "desc";

export function TradesHistory({ trades }: TradesHistoryProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [sortField, setSortField] = useState<SortField>("exitTime");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAndSortedTrades = useMemo(() => {
    let result = [...trades];

    // Apply filter
    if (filter === "wins") {
      result = result.filter((t) => t.status === "WIN");
    } else if (filter === "losses") {
      result = result.filter((t) => t.status === "LOSS");
    }

    // Apply search
    if (searchQuery) {
      result = result.filter((t) => t.symbol.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Apply sort
    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const multiplier = sortOrder === "asc" ? 1 : -1;
      return (aVal > bVal ? 1 : -1) * multiplier;
    });

    return result;
  }, [trades, filter, sortField, sortOrder, searchQuery]);

  const stats = useMemo(() => {
    const wins = trades.filter((t) => t.status === "WIN").length;
    const losses = trades.filter((t) => t.status === "LOSS").length;
    const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
    return { wins, losses, totalPnl, total: trades.length };
  }, [trades]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  if (trades.length === 0) {
    return (
      <section className="panel trades-history-panel">
        <div className="panel-heading">
          <span className="eyebrow">Histórico de Trades</span>
          <h2>Operações Fechadas</h2>
        </div>
        <p className="empty">Nenhum trade fechado ainda.</p>
      </section>
    );
  }

  return (
    <section className="panel trades-history-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Histórico de Trades</span>
          <h2>Operações Fechadas ({trades.length})</h2>
        </div>
        <div className="trades-stats">
          <span className="stat positive">
            {stats.wins} Wins
          </span>
          <span className="stat negative">
            {stats.losses} Losses
          </span>
          <span className="stat">
            Total: {formatCurrency(stats.totalPnl)}
          </span>
        </div>
      </div>

      <div className="trades-controls">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
            type="button"
          >
            Todos ({trades.length})
          </button>
          <button
            className={`filter-btn ${filter === "wins" ? "active" : ""}`}
            onClick={() => setFilter("wins")}
            type="button"
          >
            Wins ({stats.wins})
          </button>
          <button
            className={`filter-btn ${filter === "losses" ? "active" : ""}`}
            onClick={() => setFilter("losses")}
            type="button"
          >
            Losses ({stats.losses})
          </button>
        </div>
        <input
          type="search"
          placeholder="Buscar por símbolo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="table-wrapper">
        <table className="enhanced-table">
          <thead>
            <tr>
              <th>Ativo</th>
              <th>Lado</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th
                className="sortable"
                onClick={() => handleSort("exitTime")}
              >
                Data Saída {sortField === "exitTime" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th>Duração</th>
              <th
                className="sortable"
                onClick={() => handleSort("pnl")}
              >
                P&L {sortField === "pnl" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th
                className="sortable"
                onClick={() => handleSort("pnlPercent")}
              >
                P&L % {sortField === "pnlPercent" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedTrades.map((trade, index) => {
              const duration = formatDuration(trade.exitTime - trade.entryTime);
              const pnlClass = trade.pnl >= 0 ? "positive" : "negative";

              return (
                <motion.tr
                  key={trade.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.3 }}
                >
                  <td className="symbol-cell">{trade.symbol}</td>
                  <td>
                    <span className={`badge ${trade.side.toLowerCase()}`}>{trade.side}</span>
                  </td>
                  <td>{formatCurrency(trade.entryPrice)}</td>
                  <td>{formatCurrency(trade.exitPrice)}</td>
                  <td>{new Date(trade.exitTime).toLocaleString("pt-BR")}</td>
                  <td>{duration}</td>
                  <td className={pnlClass}>
                    <strong>{formatCurrency(trade.pnl)}</strong>
                  </td>
                  <td className={pnlClass}>
                    <strong>{formatPercent(trade.pnlPercent)}</strong>
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

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
