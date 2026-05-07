import { WebSocketServer } from 'ws';
import express from 'express';
import http from 'http';

const PORT = process.env.WS_PORT || 8080;
const TICK_INTERVAL = parseInt(process.env.TICK_INTERVAL_MS || '100', 10);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/swap-market' });

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', connections: wss.clients.size });
});

// Mock market data generator
function generateTick(symbol) {
  const basePrice = symbol === 'BTC-USDT' ? 100000 : 3000;
  const variance = basePrice * 0.001; // 0.1% variance
  const price = basePrice + (Math.random() - 0.5) * variance;

  return {
    dataType: symbol,
    data: [{
      s: symbol,
      c: price.toFixed(2),
      h: (price * 1.002).toFixed(2),
      l: (price * 0.998).toFixed(2),
      v: (Math.random() * 1000000).toFixed(2),
      T: Date.now()
    }]
  };
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected');

  let subscriptions = new Set();
  let intervalId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.id === 'subscribe') {
        const symbol = data.dataType;
        subscriptions.add(symbol);
        console.log(`Subscribed to ${symbol}`);

        // Send immediate tick
        ws.send(JSON.stringify(generateTick(symbol)));

        // Start interval if not already running
        if (!intervalId) {
          intervalId = setInterval(() => {
            subscriptions.forEach(sym => {
              if (ws.readyState === 1) { // OPEN
                ws.send(JSON.stringify(generateTick(sym)));
              }
            });
          }, TICK_INTERVAL);
        }

        // Send subscription confirmation
        ws.send(JSON.stringify({
          id: 'subscribe',
          code: 0,
          msg: 'Success'
        }));
      } else if (data.id === 'unsubscribe') {
        const symbol = data.dataType;
        subscriptions.delete(symbol);
        console.log(`Unsubscribed from ${symbol}`);

        if (subscriptions.size === 0 && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

server.listen(PORT, () => {
  console.log(`Mock BingX WebSocket server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/swap-market`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
