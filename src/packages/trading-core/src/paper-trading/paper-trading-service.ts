/**
 * Paper Trading Service
 * Main service that orchestrates position management, monitoring, and analytics
 */

import { PositionManager } from "./position-manager.js";
import { PerformanceAnalytics } from "./performance-analytics.js";
import { PositionMonitorWorker } from "./position-monitor-worker.js";
import type {
  PaperPosition,
  OpenPositionRequest,
  UpdatePositionRequest,
  ClosePositionRequest,
  TradeHistory,
  PerformanceMetrics,
  PositionCloseEvent,
  PaperTradingConfig
} from "./types.js";

export class PaperTradingService {
  private positionManager: PositionManager;
  private analytics: PerformanceAnalytics;
  private monitor: PositionMonitorWorker;
  private initialBalance: number;

  constructor(config: Partial<PaperTradingConfig> = {}, initialBalance: number = 10000) {
    const fullConfig: PaperTradingConfig = {
      makerFeePct: config.makerFeePct ?? 0.075,
      takerFeePct: config.takerFeePct ?? 0.075,
      slippagePct: config.slippagePct ?? 0.05,
      monitorIntervalMs: config.monitorIntervalMs ?? 5000,
      enableAutoClose: config.enableAutoClose ?? true
    };

    this.positionManager = new PositionManager(fullConfig);
    this.analytics = new PerformanceAnalytics();
    this.monitor = new PositionMonitorWorker(this.positionManager, fullConfig);
    this.initialBalance = initialBalance;
  }

  /**
   * Start the monitoring service
   */
  start(): void {
    this.monitor.start();
  }

  /**
   * Stop the monitoring service
   */
  stop(): void {
    this.monitor.stop();
  }

  /**
   * Open a new position
   */
  openPosition(request: OpenPositionRequest): PaperPosition {
    return this.positionManager.openPosition(request);
  }

  /**
   * Update position TP/SL
   */
  updatePosition(positionId: string, updates: UpdatePositionRequest): PaperPosition {
    return this.positionManager.updatePosition(positionId, updates);
  }

  /**
   * Close a position manually
   */
  closePosition(positionId: string, request: ClosePositionRequest): TradeHistory {
    return this.positionManager.closePosition(positionId, request);
  }

  /**
   * Get position by ID
   */
  getPosition(positionId: string): PaperPosition | undefined {
    return this.positionManager.getPosition(positionId);
  }

  /**
   * Get all positions for a user
   */
  getUserPositions(userId: string, status?: 'OPEN' | 'CLOSED'): PaperPosition[] {
    return this.positionManager.getUserPositions(userId, status);
  }

  /**
   * Get trade history for a user
   */
  getUserTradeHistory(userId: string, limit?: number): TradeHistory[] {
    return this.positionManager.getUserTradeHistory(userId, limit);
  }

  /**
   * Get performance metrics for a user
   */
  getUserPerformance(userId: string): PerformanceMetrics {
    const trades = this.positionManager.getUserTradeHistory(userId);
    return this.analytics.calculateMetrics(trades, this.initialBalance);
  }

  /**
   * Update market price for a symbol
   */
  updateMarketPrice(symbol: string, price: number): void {
    this.monitor.updatePrice(symbol, price);
  }

  /**
   * Update multiple market prices
   */
  updateMarketPrices(prices: Map<string, number>): void {
    this.monitor.updatePrices(prices);
  }

  /**
   * Register handler for position close events
   */
  onPositionClose(handler: (event: PositionCloseEvent) => void): void {
    this.monitor.onPositionClose(handler);
  }

  /**
   * Get monitor status
   */
  getMonitorStatus(): { isRunning: boolean; openPositions: number; trackedSymbols: number } {
    return this.monitor.getStatus();
  }

  /**
   * Get all open positions
   */
  getAllOpenPositions(): PaperPosition[] {
    return this.positionManager.getOpenPositions();
  }

  /**
   * Get overall performance metrics
   */
  getOverallPerformance(): PerformanceMetrics {
    const trades = this.positionManager.getAllTradeHistory();
    return this.analytics.calculateMetrics(trades, this.initialBalance);
  }
}
