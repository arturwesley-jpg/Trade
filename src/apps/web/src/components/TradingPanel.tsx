/**
 * Trading Panel Component
 * Interactive panel for placing orders with risk management controls
 */

import { memo, useState } from "react";
import { motion } from "framer-motion";

interface TradingPanelProps {
  symbol: string;
}

export const TradingPanel = memo(function TradingPanel({ symbol }: TradingPanelProps) {
  const [orderType, setOrderType] = useState<"market" | "limit" | "stop">("market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Order submission logic will be handled by parent
    console.log("Order submitted:", {
      symbol,
      orderType,
      side,
      amount,
      price,
      leverage,
      stopLoss,
      takeProfit
    });
  };

  const leverageOptions = [1, 2, 3, 5, 10, 20];

  return (
    <div className="trading-panel">
      <div className="panel-header">
        <h3>Place Order</h3>
        <span className="paper-badge">PAPER MODE</span>
      </div>

      <form onSubmit={handleSubmit} className="trading-form">
        {/* Order Type Selector */}
        <div className="order-type-selector">
          <button
            type="button"
            className={`order-type-btn ${orderType === "market" ? "active" : ""}`}
            onClick={() => setOrderType("market")}
          >
            Market
          </button>
          <button
            type="button"
            className={`order-type-btn ${orderType === "limit" ? "active" : ""}`}
            onClick={() => setOrderType("limit")}
          >
            Limit
          </button>
          <button
            type="button"
            className={`order-type-btn ${orderType === "stop" ? "active" : ""}`}
            onClick={() => setOrderType("stop")}
          >
            Stop
          </button>
        </div>

        {/* Side Selector */}
        <div className="side-selector">
          <button
            type="button"
            className={`side-btn buy ${side === "buy" ? "active" : ""}`}
            onClick={() => setSide("buy")}
          >
            Buy / Long
          </button>
          <button
            type="button"
            className={`side-btn sell ${side === "sell" ? "active" : ""}`}
            onClick={() => setSide("sell")}
          >
            Sell / Short
          </button>
        </div>

        {/* Price Input (for limit/stop orders) */}
        {orderType !== "market" && (
          <div className="form-group">
            <label htmlFor="price">Price (USDT)</label>
            <input
              id="price"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter price"
              className="form-input"
            />
          </div>
        )}

        {/* Amount Input */}
        <div className="form-group">
          <label htmlFor="amount">Amount (USDT)</label>
          <input
            id="amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="form-input"
            required
          />
        </div>

        {/* Leverage Selector */}
        <div className="form-group">
          <label>Leverage: {leverage}x</label>
          <div className="leverage-selector">
            {leverageOptions.map((lev) => (
              <button
                key={lev}
                type="button"
                className={`leverage-btn ${leverage === lev ? "active" : ""}`}
                onClick={() => setLeverage(lev)}
              >
                {lev}x
              </button>
            ))}
          </div>
        </div>

        {/* Stop Loss */}
        <div className="form-group">
          <label htmlFor="stopLoss">Stop Loss (Optional)</label>
          <input
            id="stopLoss"
            type="number"
            step="0.01"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder="Stop loss price"
            className="form-input"
          />
        </div>

        {/* Take Profit */}
        <div className="form-group">
          <label htmlFor="takeProfit">Take Profit (Optional)</label>
          <input
            id="takeProfit"
            type="number"
            step="0.01"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            placeholder="Take profit price"
            className="form-input"
          />
        </div>

        {/* Order Summary */}
        {amount && (
          <motion.div
            className="order-summary"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.3 }}
          >
            <div className="summary-row">
              <span>Position Size:</span>
              <span className="summary-value">
                ${(parseFloat(amount) * leverage).toFixed(2)}
              </span>
            </div>
            <div className="summary-row">
              <span>Margin Required:</span>
              <span className="summary-value">${amount}</span>
            </div>
            {stopLoss && (
              <div className="summary-row">
                <span>Max Loss:</span>
                <span className="summary-value negative">
                  ${Math.abs(parseFloat(amount) * leverage * 0.05).toFixed(2)}
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className={`submit-btn ${side}`}
          disabled={!amount}
        >
          {side === "buy" ? "Place Buy Order" : "Place Sell Order"}
        </button>

        <div className="trading-disclaimer">
          <p>⚠️ Paper trading mode - No real funds at risk</p>
        </div>
      </form>
    </div>
  );
});
