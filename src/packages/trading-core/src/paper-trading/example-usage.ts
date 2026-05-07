/**
 * Paper Trading System v2 - Example Usage
 */

import { PaperTradingService } from "./paper-trading-service.js";

// Initialize the service
const service = new PaperTradingService(
  {
    makerFeePct: 0.075,
    takerFeePct: 0.075,
    slippagePct: 0.05,
    monitorIntervalMs: 5000,
    enableAutoClose: true
  },
  10000 // $10,000 initial balance
);

// Start monitoring
service.start();

// Listen for position close events
service.onPositionClose((event) => {
  console.log(`Position closed: ${event.positionId}`);
  console.log(`Reason: ${event.reason}`);
  console.log(`PnL: $${event.pnl.toFixed(2)}`);
});

// Example 1: Open a long position with TP/SL
const longPosition = service.openPosition({
  userId: "user123",
  symbol: "BTC-USDT",
  side: "long",
  entryPrice: 100000,
  quantity: 0.1,
  leverage: 10,
  marginUsdt: 1000,
  takeProfit: [105000, 110000], // Multiple TP levels
  stopLoss: 98000
});

console.log("Long position opened:", longPosition.id);

// Example 2: Open a short position with trailing stop
const shortPosition = service.openPosition({
  userId: "user123",
  symbol: "ETH-USDT",
  side: "short",
  entryPrice: 3000,
  quantity: 1,
  leverage: 5,
  marginUsdt: 600,
  stopLoss: 3100,
  trailingStop: {
    distance: 2 // 2% trailing stop
  }
});

console.log("Short position opened:", shortPosition.id);

// Example 3: Update position TP/SL
service.updatePosition(longPosition.id, {
  takeProfit: [106000],
  stopLoss: 99000
});

console.log("Position updated");

// Example 4: Simulate price updates
service.updateMarketPrice("BTC-USDT", 101000);
service.updateMarketPrice("ETH-USDT", 2950);

// Example 5: Get user positions
const openPositions = service.getUserPositions("user123", "OPEN");
console.log(`Open positions: ${openPositions.length}`);

// Example 6: Close position manually
const trade = service.closePosition(longPosition.id, {
  exitPrice: 105000,
  reason: "MANUAL"
});

console.log("Trade closed:", {
  pnl: trade.pnl,
  pnlPercentage: trade.pnlPercentage,
  duration: trade.duration
});

// Example 7: Get performance metrics
const performance = service.getUserPerformance("user123");
console.log("Performance:", {
  totalTrades: performance.totalTrades,
  winRate: performance.winRate,
  totalPnL: performance.totalPnL,
  sharpeRatio: performance.sharpeRatio,
  maxDrawdown: performance.maxDrawdown
});

// Example 8: Get trade history
const history = service.getUserTradeHistory("user123", 10);
console.log(`Last ${history.length} trades:`, history);

// Example 9: Get monitor status
const status = service.getMonitorStatus();
console.log("Monitor status:", status);

// Cleanup
process.on("SIGINT", () => {
  service.stop();
  process.exit(0);
});
