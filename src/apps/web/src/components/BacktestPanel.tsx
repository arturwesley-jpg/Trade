import { useState, memo } from "react";
import { motion } from "framer-motion";
import { useTrading } from "../contexts/TradingContext.js";
import type { BacktestParams } from "../types/trading.js";
import { LoadingSpinner } from "./LoadingSpinner.js";

export const BacktestPanel = memo(function BacktestPanel() {
  const { backtests, isLoading, error, createBacktest, loadBacktests } = useTrading();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<BacktestParams>({
    name: "",
    description: "",
    symbol: "BTCUSDT",
    startDate: "",
    endDate: "",
    interval: "1h",
    initialCapital: 10000,
    feeRate: 0.001,
    slippageRate: 0.0005,
    strategyName: "RSI Strategy",
    strategyDescription: "",
    strategyParameters: {
      rsiPeriod: 14,
      oversold: 30,
      overbought: 70
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBacktest(formData);
      setIsFormOpen(false);
      setFormData({
        name: "",
        description: "",
        symbol: "BTCUSDT",
        startDate: "",
        endDate: "",
        interval: "1h",
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        strategyName: "RSI Strategy",
        strategyDescription: "",
        strategyParameters: {
          rsiPeriod: 14,
          oversold: 30,
          overbought: 70
        }
      });
    } catch (err) {
      console.error("Failed to create backtest:", err);
    }
  };

  const handleInputChange = (field: keyof BacktestParams, value: any) => {
    setFormData((prev: BacktestParams) => ({ ...prev, [field]: value }));
  };

  return (
    <motion.div
      className="backtest-panel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="panel">
        <header className="panel-header">
          <h2>Backtests</h2>
          <button
            className="btn btn-primary"
            onClick={() => setIsFormOpen(!isFormOpen)}
            disabled={isLoading}
          >
            {isFormOpen ? "Cancelar" : "Novo Backtest"}
          </button>
        </header>

        {error && (
          <div className="alert alert-error" style={{ margin: "1rem" }}>
            {error}
          </div>
        )}

        {isFormOpen && (
          <motion.form
            className="backtest-form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ padding: "1rem", borderBottom: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="name">Nome *</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  required
                  placeholder="Ex: RSI Strategy Test"
                />
              </div>

              <div className="form-group">
                <label htmlFor="symbol">Símbolo *</label>
                <input
                  id="symbol"
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => handleInputChange("symbol", e.target.value.toUpperCase())}
                  required
                  placeholder="BTCUSDT"
                />
              </div>

              <div className="form-group">
                <label htmlFor="startDate">Data Início *</label>
                <input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange("startDate", e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="endDate">Data Fim *</label>
                <input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange("endDate", e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="interval">Intervalo *</label>
                <select
                  id="interval"
                  value={formData.interval}
                  onChange={(e) => handleInputChange("interval", e.target.value)}
                  required
                >
                  <option value="1m">1 minuto</option>
                  <option value="5m">5 minutos</option>
                  <option value="15m">15 minutos</option>
                  <option value="1h">1 hora</option>
                  <option value="4h">4 horas</option>
                  <option value="1d">1 dia</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="initialCapital">Capital Inicial *</label>
                <input
                  id="initialCapital"
                  type="number"
                  value={formData.initialCapital}
                  onChange={(e) => handleInputChange("initialCapital", parseFloat(e.target.value))}
                  required
                  min="0"
                  step="100"
                />
              </div>

              <div className="form-group">
                <label htmlFor="feeRate">Taxa de Fee (%) *</label>
                <input
                  id="feeRate"
                  type="number"
                  value={formData.feeRate * 100}
                  onChange={(e) => handleInputChange("feeRate", parseFloat(e.target.value) / 100)}
                  required
                  min="0"
                  max="10"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label htmlFor="slippageRate">Taxa de Slippage (%) *</label>
                <input
                  id="slippageRate"
                  type="number"
                  value={formData.slippageRate * 100}
                  onChange={(e) => handleInputChange("slippageRate", parseFloat(e.target.value) / 100)}
                  required
                  min="0"
                  max="10"
                  step="0.01"
                />
              </div>

              <div className="form-group full-width">
                <label htmlFor="description">Descrição</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Descrição opcional do backtest"
                  rows={3}
                />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsFormOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? "Criando..." : "Criar Backtest"}
              </button>
            </div>
          </motion.form>
        )}

        <div className="backtest-list">
          {isLoading && backtests.length === 0 ? (
            <LoadingSpinner message="Carregando backtests..." />
          ) : backtests.length === 0 ? (
            <p className="empty" style={{ padding: "2rem", textAlign: "center" }}>
              Nenhum backtest encontrado. Crie um novo backtest para começar.
            </p>
          ) : (
            <div className="backtest-grid">
              {backtests.map((backtest) => (
                <motion.div
                  key={backtest.id}
                  className="backtest-card"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="backtest-card-header">
                    <h3>{backtest.name}</h3>
                    <span className={`badge badge-${backtest.status}`}>
                      {backtest.status}
                    </span>
                  </div>

                  <div className="backtest-card-body">
                    <div className="backtest-info">
                      <span className="label">Símbolo:</span>
                      <span className="value">{backtest.symbol}</span>
                    </div>
                    <div className="backtest-info">
                      <span className="label">Período:</span>
                      <span className="value">
                        {new Date(backtest.startDate).toLocaleDateString()} - {new Date(backtest.endDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="backtest-info">
                      <span className="label">Intervalo:</span>
                      <span className="value">{backtest.interval}</span>
                    </div>
                    <div className="backtest-info">
                      <span className="label">Capital:</span>
                      <span className="value">${backtest.initialCapital.toLocaleString()}</span>
                    </div>
                    {backtest.description && (
                      <p className="backtest-description">{backtest.description}</p>
                    )}
                  </div>

                  <div className="backtest-card-footer">
                    <small>
                      Criado em {new Date(backtest.createdAt).toLocaleString()}
                    </small>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});
