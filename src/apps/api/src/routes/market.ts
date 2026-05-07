import type { Express } from "express";
import type { MarketDataProvider } from "@trade/exchange";

export interface MarketRoutesOptions {
  marketDataProvider: MarketDataProvider;
}

export function registerMarketRoutes(app: Express, options: MarketRoutesOptions) {
  const { marketDataProvider } = options;

  /**
   * GET /market/ticker/:symbol
   * Get current ticker for a symbol
   */
  app.get("/market/ticker/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const tick = await marketDataProvider.getTick(symbol);
      res.json(tick);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch ticker";
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /market/tickers
   * Get tickers for multiple symbols
   */
  app.get("/market/tickers", async (req, res) => {
    try {
      const symbols = (req.query.symbols as string)?.split(",") || ["BTC-USDT", "ETH-USDT"];
      const ticks = await Promise.all(
        symbols.map(symbol => marketDataProvider.getTick(symbol))
      );
      res.json(ticks);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch tickers";
      res.status(500).json({ error: message });
    }
  });
}
