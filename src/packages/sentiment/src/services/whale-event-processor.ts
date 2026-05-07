/**
 * Whale Event Processor
 *
 * Processes whale activities and stores them in the database
 * Correlates whale movements with price action
 */

import { WhaleTracker } from '../providers/whale-tracker';
import type { PostgresWhaleEventRepository } from '@trading-bot/database';
import type { WhaleActivity } from '../types';
import { logger } from '@trading-bot/shared';

export interface WhaleEventProcessorConfig {
  whaleTracker: WhaleTracker;
  repository: PostgresWhaleEventRepository;
  processingInterval?: number; // milliseconds
  symbols?: string[];
}

export class WhaleEventProcessor {
  private whaleTracker: WhaleTracker;
  private repository: PostgresWhaleEventRepository;
  private processingInterval: number;
  private symbols: string[];
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor(config: WhaleEventProcessorConfig) {
    this.whaleTracker = config.whaleTracker;
    this.repository = config.repository;
    this.processingInterval = config.processingInterval || 60000; // 1 minute default
    this.symbols = config.symbols || ['BTC', 'ETH', 'BNB', 'SOL', 'XRP'];
  }

  /**
   * Start processing whale events
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Whale event processor already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting whale event processor', {
      interval: this.processingInterval,
      symbols: this.symbols,
    });

    // Process immediately
    this.processEvents().catch((error) => {
      logger.error('Failed to process whale events', { error });
    });

    // Schedule periodic processing
    this.intervalId = setInterval(() => {
      this.processEvents().catch((error) => {
        logger.error('Failed to process whale events', { error });
      });
    }, this.processingInterval);
  }

  /**
   * Stop processing whale events
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    logger.info('Stopped whale event processor');
  }

  /**
   * Process whale events for all tracked symbols
   */
  private async processEvents(): Promise<void> {
    logger.debug('Processing whale events', { symbols: this.symbols });

    for (const symbol of this.symbols) {
      try {
        await this.processSymbol(symbol);
      } catch (error) {
        logger.error('Failed to process whale events for symbol', { symbol, error });
      }
    }
  }

  /**
   * Process whale events for a specific symbol
   */
  private async processSymbol(symbol: string): Promise<void> {
    try {
      // Fetch recent whale activities
      const activities = await this.whaleTracker.fetchWhaleAlertTransactions(
        symbol,
        undefined,
        50
      );

      if (activities.length === 0) {
        logger.debug('No whale activities found', { symbol });
        return;
      }

      // Store each activity as an event
      for (const activity of activities) {
        await this.storeWhaleEvent(activity);
      }

      logger.info('Processed whale events', {
        symbol,
        count: activities.length,
      });
    } catch (error) {
      logger.error('Failed to process symbol', { symbol, error });
      throw error;
    }
  }

  /**
   * Store whale activity as an event in the database
   */
  private async storeWhaleEvent(activity: WhaleActivity): Promise<void> {
    try {
      // Check if event already exists (by txHash)
      const existingEvents = await this.repository.findRecent(1000);
      const exists = existingEvents.some(
        (e) => e.metadata?.txHash === activity.txHash
      );

      if (exists) {
        logger.debug('Whale event already exists', { txHash: activity.txHash });
        return;
      }

      // Map activity type to event type
      const eventType = this.mapActivityTypeToEventType(activity.type);

      // Create event
      await this.repository.create({
        eventType,
        symbol: activity.symbol,
        amount: activity.amount.toString(),
        usdValue: activity.amountUSD.toString(),
        source: activity.fromAddress || 'unknown',
        destination: activity.toAddress || 'unknown',
        severity: activity.significance,
        timestamp: activity.timestamp,
        metadata: {
          txHash: activity.txHash,
          type: activity.type,
          fromAddress: activity.fromAddress,
          toAddress: activity.toAddress,
        },
      });

      logger.debug('Stored whale event', {
        symbol: activity.symbol,
        type: eventType,
        amount: activity.amountUSD,
      });
    } catch (error) {
      logger.error('Failed to store whale event', { error, activity });
    }
  }

  /**
   * Map whale activity type to database event type
   */
  private mapActivityTypeToEventType(
    type: WhaleActivity['type']
  ): string {
    const mapping: Record<WhaleActivity['type'], string> = {
      LARGE_TRANSFER: 'large_transfer',
      EXCHANGE_INFLOW: 'exchange_inflow',
      EXCHANGE_OUTFLOW: 'exchange_outflow',
      WHALE_ACCUMULATION: 'accumulation',
      WHALE_DISTRIBUTION: 'distribution',
    };

    return mapping[type] || 'unknown';
  }

  /**
   * Analyze correlation between whale activity and price movements
   */
  async analyzeCorrelation(
    symbol: string,
    timeWindowHours: number = 24
  ): Promise<{
    correlation: number; // -1 to 1
    confidence: number; // 0-100
    summary: string;
  }> {
    try {
      const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
      const events = await this.repository.findByTimeRange(
        cutoffTime,
        new Date()
      );

      const symbolEvents = events.filter((e) => e.symbol === symbol);

      if (symbolEvents.length < 5) {
        return {
          correlation: 0,
          confidence: 0,
          summary: 'Insufficient data for correlation analysis',
        };
      }

      // Analyze whale activity patterns
      const inflowEvents = symbolEvents.filter(
        (e) => e.eventType === 'exchange_inflow'
      );
      const outflowEvents = symbolEvents.filter(
        (e) => e.eventType === 'exchange_outflow'
      );

      const totalInflow = inflowEvents.reduce((sum, e) => sum + e.usdValue, 0);
      const totalOutflow = outflowEvents.reduce((sum, e) => sum + e.usdValue, 0);
      const netFlow = totalOutflow - totalInflow;

      // Calculate correlation score
      // Positive netFlow (outflow > inflow) suggests accumulation (bullish)
      // Negative netFlow (inflow > outflow) suggests distribution (bearish)
      const maxFlow = Math.max(Math.abs(totalInflow), Math.abs(totalOutflow));
      const correlation = maxFlow > 0 ? netFlow / maxFlow : 0;

      // Confidence based on volume and event count
      const volumeScore = Math.min(100, (maxFlow / 10000000) * 50); // $10M = 50%
      const countScore = Math.min(100, (symbolEvents.length / 20) * 50); // 20 events = 50%
      const confidence = (volumeScore + countScore) / 2;

      let summary = '';
      if (correlation > 0.3) {
        summary = `Strong accumulation detected: ${outflowEvents.length} outflows vs ${inflowEvents.length} inflows`;
      } else if (correlation < -0.3) {
        summary = `Strong distribution detected: ${inflowEvents.length} inflows vs ${outflowEvents.length} outflows`;
      } else {
        summary = `Mixed whale activity: ${symbolEvents.length} events with balanced flows`;
      }

      return {
        correlation,
        confidence: Math.round(confidence),
        summary,
      };
    } catch (error) {
      logger.error('Failed to analyze correlation', { error, symbol });
      return {
        correlation: 0,
        confidence: 0,
        summary: 'Error analyzing correlation',
      };
    }
  }

  /**
   * Get whale activity summary for a symbol
   */
  async getActivitySummary(
    symbol: string,
    timeWindowHours: number = 24
  ): Promise<{
    totalEvents: number;
    totalVolume: number;
    largestTransaction: number;
    exchangeInflows: number;
    exchangeOutflows: number;
    netFlow: number;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }> {
    try {
      const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
      const events = await this.repository.findByTimeRange(
        cutoffTime,
        new Date()
      );

      const symbolEvents = events.filter((e) => e.symbol === symbol);

      const totalVolume = symbolEvents.reduce((sum, e) => sum + e.usdValue, 0);
      const largestTransaction = Math.max(
        ...symbolEvents.map((e) => e.usdValue),
        0
      );

      const exchangeInflows = symbolEvents
        .filter((e) => e.eventType === 'exchange_inflow')
        .reduce((sum, e) => sum + e.usdValue, 0);

      const exchangeOutflows = symbolEvents
        .filter((e) => e.eventType === 'exchange_outflow')
        .reduce((sum, e) => sum + e.usdValue, 0);

      const netFlow = exchangeOutflows - exchangeInflows;

      let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
      if (netFlow > 1000000) {
        sentiment = 'BULLISH';
      } else if (netFlow < -1000000) {
        sentiment = 'BEARISH';
      }

      return {
        totalEvents: symbolEvents.length,
        totalVolume,
        largestTransaction,
        exchangeInflows,
        exchangeOutflows,
        netFlow,
        sentiment,
      };
    } catch (error) {
      logger.error('Failed to get activity summary', { error, symbol });
      throw error;
    }
  }
}
