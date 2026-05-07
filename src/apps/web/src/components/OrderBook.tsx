/**
 * Order Book Component
 * Real-time order book visualization with depth analysis
 */

import { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";

interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
}

interface OrderBookProps {
  symbol: string;
}

export const OrderBook = memo(function OrderBook({ symbol }: OrderBookProps) {
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);
  const [precision, setPrecision] = useState(2);

  // Mock data generator for demonstration
  useEffect(() => {
    const generateMockData = () => {
      const basePrice = 45000;
      const mockBids: OrderBookEntry[] = [];
      const mockAsks: OrderBookEntry[] = [];

      let bidTotal = 0;
      for (let i = 0; i < 15; i++) {
        const price = basePrice - (i * 10);
        const amount = Math.random() * 2 + 0.1;
        bidTotal += amount;
        mockBids.push({ price, amount, total: bidTotal });
      }

      let askTotal = 0;
      for (let i = 0; i < 15; i++) {
        const price = basePrice + (i * 10);
        const amount = Math.random() * 2 + 0.1;
        askTotal += amount;
        mockAsks.push({ price, amount, total: askTotal });
      }

      setBids(mockBids);
      setAsks(mockAsks);
    };

    generateMockData();
    const interval = setInterval(generateMockData, 3000);

    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    return price.toFixed(precision);
  };

  const formatAmount = (amount: number) => {
    return amount.toFixed(4);
  };

  const getDepthPercentage = (total: number, maxTotal: number) => {
    return (total / maxTotal) * 100;
  };

  const maxBidTotal = bids.length > 0 ? bids[bids.length - 1].total : 1;
  const maxAskTotal = asks.length > 0 ? asks[asks.length - 1].total : 1;

  return (
    <div className="order-book">
      <div className="panel-header">
        <h3>Order Book</h3>
        <div className="precision-selector">
          <button
            className={`precision-btn ${precision === 0 ? "active" : ""}`}
            onClick={() => setPrecision(0)}
          >
            0.1
          </button>
          <button
            className={`precision-btn ${precision === 1 ? "active" : ""}`}
            onClick={() => setPrecision(1)}
          >
            0.01
          </button>
          <button
            className={`precision-btn ${precision === 2 ? "active" : ""}`}
            onClick={() => setPrecision(2)}
          >
            0.001
          </button>
        </div>
      </div>

      <div className="order-book-content">
        {/* Header */}
        <div className="order-book-header">
          <span className="col-price">Price (USDT)</span>
          <span className="col-amount">Amount</span>
          <span className="col-total">Total</span>
        </div>

        {/* Asks (Sell Orders) */}
        <div className="order-book-asks">
          {asks.slice(0, 10).reverse().map((ask, index) => (
            <motion.div
              key={`ask-${index}`}
              className="order-book-row ask"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.02 }}
            >
              <div
                className="depth-bar ask-bar"
                style={{ width: `${getDepthPercentage(ask.total, maxAskTotal)}%` }}
              />
              <span className="col-price ask-price">{formatPrice(ask.price)}</span>
              <span className="col-amount">{formatAmount(ask.amount)}</span>
              <span className="col-total">{formatAmount(ask.total)}</span>
            </motion.div>
          ))}
        </div>

        {/* Spread */}
        <div className="order-book-spread">
          <div className="spread-info">
            {bids.length > 0 && asks.length > 0 && (
              <>
                <span className="spread-label">Spread:</span>
                <span className="spread-value">
                  ${(asks[0].price - bids[0].price).toFixed(2)}
                </span>
                <span className="spread-percentage">
                  ({(((asks[0].price - bids[0].price) / bids[0].price) * 100).toFixed(3)}%)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Bids (Buy Orders) */}
        <div className="order-book-bids">
          {bids.slice(0, 10).map((bid, index) => (
            <motion.div
              key={`bid-${index}`}
              className="order-book-row bid"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.02 }}
            >
              <div
                className="depth-bar bid-bar"
                style={{ width: `${getDepthPercentage(bid.total, maxBidTotal)}%` }}
              />
              <span className="col-price bid-price">{formatPrice(bid.price)}</span>
              <span className="col-amount">{formatAmount(bid.amount)}</span>
              <span className="col-total">{formatAmount(bid.total)}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
});
