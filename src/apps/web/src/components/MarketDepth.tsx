/**
 * Market Depth Component
 * Visualizes market depth with interactive chart
 */

import { memo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface MarketDepthProps {
  symbol: string;
}

interface DepthPoint {
  price: number;
  depth: number;
}

export const MarketDepth = memo(function MarketDepth({ symbol }: MarketDepthProps) {
  const [bidDepth, setBidDepth] = useState<DepthPoint[]>([]);
  const [askDepth, setAskDepth] = useState<DepthPoint[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate mock depth data
  useEffect(() => {
    const generateDepthData = () => {
      const basePrice = 45000;
      const bids: DepthPoint[] = [];
      const asks: DepthPoint[] = [];

      let bidCumulative = 0;
      for (let i = 0; i < 50; i++) {
        const price = basePrice - (i * 5);
        bidCumulative += Math.random() * 10 + 5;
        bids.push({ price, depth: bidCumulative });
      }

      let askCumulative = 0;
      for (let i = 0; i < 50; i++) {
        const price = basePrice + (i * 5);
        askCumulative += Math.random() * 10 + 5;
        asks.push({ price, depth: askCumulative });
      }

      setBidDepth(bids);
      setAskDepth(asks);
    };

    generateDepthData();
    const interval = setInterval(generateDepthData, 5000);

    return () => clearInterval(interval);
  }, []);

  // Draw depth chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || bidDepth.length === 0 || askDepth.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate scales
    const allDepths = [...bidDepth.map(d => d.depth), ...askDepth.map(d => d.depth)];
    const maxDepth = Math.max(...allDepths);
    const minPrice = bidDepth[bidDepth.length - 1].price;
    const maxPrice = askDepth[askDepth.length - 1].price;

    const scaleX = (price: number) => {
      return ((price - minPrice) / (maxPrice - minPrice)) * width;
    };

    const scaleY = (depth: number) => {
      return height - (depth / maxDepth) * height;
    };

    // Draw grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw bid depth (green)
    ctx.fillStyle = "rgba(34, 197, 94, 0.2)";
    ctx.strokeStyle = "rgba(34, 197, 94, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height);
    bidDepth.forEach((point, index) => {
      const x = scaleX(point.price);
      const y = scaleY(point.depth);
      if (index === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.lineTo(scaleX(bidDepth[bidDepth.length - 1].price), height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw ask depth (red)
    ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
    ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaleX(askDepth[0].price), height);
    askDepth.forEach((point) => {
      const x = scaleX(point.price);
      const y = scaleY(point.depth);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw center line (current price)
    const centerX = width / 2;
    ctx.strokeStyle = "rgba(34, 211, 238, 0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [bidDepth, askDepth]);

  return (
    <div className="market-depth">
      <div className="panel-header">
        <h3>Market Depth</h3>
        <div className="depth-legend">
          <span className="legend-item bid">
            <span className="legend-dot" />
            Bids
          </span>
          <span className="legend-item ask">
            <span className="legend-dot" />
            Asks
          </span>
        </div>
      </div>

      <div className="depth-chart-container">
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          className="depth-canvas"
        />
      </div>

      <div className="depth-stats">
        <div className="stat-item">
          <span className="stat-label">Bid Depth:</span>
          <span className="stat-value bid">
            {bidDepth.length > 0 ? bidDepth[bidDepth.length - 1].depth.toFixed(2) : "—"}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Ask Depth:</span>
          <span className="stat-value ask">
            {askDepth.length > 0 ? askDepth[askDepth.length - 1].depth.toFixed(2) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
});
