/**
 * Drawdown Protection System
 *
 * Features:
 * - Real-time drawdown monitoring
 * - Auto-pause trading on drawdown threshold
 * - Gradual position reduction
 * - Recovery mode
 */

export interface DrawdownConfig {
  maxDrawdown: number; // Max drawdown before pause (%)
  warningDrawdown: number; // Warning threshold (%)
  recoveryThreshold: number; // Drawdown level to exit recovery mode (%)
  positionReductionStart: number; // Start reducing positions at this drawdown (%)
  positionReductionRate: number; // Reduce positions by this % per drawdown %
}

export interface DrawdownState {
  peakBalance: number;
  currentBalance: number;
  currentDrawdown: number;
  currentDrawdownPct: number;
  maxDrawdownReached: number;
  status: 'normal' | 'warning' | 'reducing' | 'paused' | 'recovery';
  positionReductionFactor: number; // 0-1, multiply position sizes by this
  isPaused: boolean;
  lastUpdated: Date;
}

export interface DrawdownEvent {
  timestamp: Date;
  type: 'warning' | 'reduction' | 'pause' | 'recovery' | 'new-peak';
  drawdownPct: number;
  balance: number;
  peakBalance: number;
  message: string;
}

export interface DrawdownHistory {
  date: Date;
  balance: number;
  peakBalance: number;
  drawdown: number;
  drawdownPct: number;
}

export class DrawdownMonitor {
  private config: DrawdownConfig;
  private state: DrawdownState;
  private history: DrawdownHistory[] = [];
  private events: DrawdownEvent[] = [];
  private peakBalanceHistory: { date: Date; balance: number }[] = [];

  constructor(config: DrawdownConfig, initialBalance: number) {
    this.config = config;
    this.state = {
      peakBalance: initialBalance,
      currentBalance: initialBalance,
      currentDrawdown: 0,
      currentDrawdownPct: 0,
      maxDrawdownReached: 0,
      status: 'normal',
      positionReductionFactor: 1.0,
      isPaused: false,
      lastUpdated: new Date()
    };

    this.peakBalanceHistory.push({ date: new Date(), balance: initialBalance });
  }

  /**
   * Update balance and check drawdown status
   */
  updateBalance(newBalance: number): DrawdownState {
    const previousBalance = this.state.currentBalance;
    this.state.currentBalance = newBalance;
    this.state.lastUpdated = new Date();

    // Check for new peak
    if (newBalance > this.state.peakBalance) {
      this.handleNewPeak(newBalance);
    }

    // Calculate current drawdown
    this.calculateDrawdown();

    // Update status based on drawdown
    this.updateStatus();

    // Record history
    this.recordHistory();

    return this.state;
  }

  /**
   * Get current drawdown state
   */
  getState(): DrawdownState {
    return { ...this.state };
  }

  /**
   * Check if trading should be paused
   */
  isTradingPaused(): boolean {
    return this.state.isPaused;
  }

  /**
   * Get position reduction factor (0-1)
   * Multiply intended position size by this factor
   */
  getPositionReductionFactor(): number {
    return this.state.positionReductionFactor;
  }

  /**
   * Get recent drawdown events
   */
  getRecentEvents(limit: number = 10): DrawdownEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get drawdown history
   */
  getHistory(days: number = 30): DrawdownHistory[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.history.filter(h => h.date >= cutoffDate);
  }

  /**
   * Calculate maximum drawdown over a period
   */
  calculateMaxDrawdown(days: number = 30): {
    maxDrawdown: number;
    maxDrawdownPct: number;
    startDate: Date;
    endDate: Date;
    peakBalance: number;
    troughBalance: number;
  } {
    const historyPeriod = this.getHistory(days);

    if (historyPeriod.length === 0) {
      return {
        maxDrawdown: 0,
        maxDrawdownPct: 0,
        startDate: new Date(),
        endDate: new Date(),
        peakBalance: this.state.currentBalance,
        troughBalance: this.state.currentBalance
      };
    }

    let maxDrawdown = 0;
    let maxDrawdownPct = 0;
    let startDate = historyPeriod[0].date;
    let endDate = historyPeriod[0].date;
    let peakBalance = historyPeriod[0].peakBalance;
    let troughBalance = historyPeriod[0].balance;

    for (const record of historyPeriod) {
      if (record.drawdownPct > maxDrawdownPct) {
        maxDrawdownPct = record.drawdownPct;
        maxDrawdown = record.drawdown;
        endDate = record.date;
        troughBalance = record.balance;

        // Find the peak that led to this drawdown
        const peakRecord = this.peakBalanceHistory
          .filter(p => p.date <= record.date)
          .sort((a, b) => b.balance - a.balance)[0];

        if (peakRecord) {
          startDate = peakRecord.date;
          peakBalance = peakRecord.balance;
        }
      }
    }

    return {
      maxDrawdown: this.round(maxDrawdown, 2),
      maxDrawdownPct: this.round(maxDrawdownPct, 2),
      startDate,
      endDate,
      peakBalance: this.round(peakBalance, 2),
      troughBalance: this.round(troughBalance, 2)
    };
  }

  /**
   * Calculate drawdown statistics
   */
  getDrawdownStats(days: number = 30): {
    currentDrawdown: number;
    maxDrawdown: number;
    avgDrawdown: number;
    drawdownDuration: number; // Days in current drawdown
    recoveryFactor: number; // % recovered from max drawdown
  } {
    const historyPeriod = this.getHistory(days);
    const maxDD = this.calculateMaxDrawdown(days);

    // Calculate average drawdown
    const avgDrawdown = historyPeriod.length > 0
      ? historyPeriod.reduce((sum, h) => sum + h.drawdownPct, 0) / historyPeriod.length
      : 0;

    // Calculate drawdown duration
    let drawdownDuration = 0;
    for (let i = historyPeriod.length - 1; i >= 0; i--) {
      if (historyPeriod[i].drawdownPct > 0) {
        drawdownDuration++;
      } else {
        break;
      }
    }

    // Calculate recovery factor
    const recoveryFactor = this.state.maxDrawdownReached > 0
      ? ((this.state.maxDrawdownReached - this.state.currentDrawdownPct) / this.state.maxDrawdownReached) * 100
      : 0;

    return {
      currentDrawdown: this.round(this.state.currentDrawdownPct, 2),
      maxDrawdown: this.round(maxDD.maxDrawdownPct, 2),
      avgDrawdown: this.round(avgDrawdown, 2),
      drawdownDuration,
      recoveryFactor: this.round(Math.max(0, recoveryFactor), 2)
    };
  }

  /**
   * Force resume trading (manual override)
   */
  forceResume(): void {
    this.state.isPaused = false;
    this.state.status = 'recovery';
    this.addEvent({
      timestamp: new Date(),
      type: 'recovery',
      drawdownPct: this.state.currentDrawdownPct,
      balance: this.state.currentBalance,
      peakBalance: this.state.peakBalance,
      message: 'Trading manually resumed - entering recovery mode'
    });
  }

  /**
   * Reset peak balance (use with caution)
   */
  resetPeak(newPeak?: number): void {
    const peak = newPeak ?? this.state.currentBalance;
    this.state.peakBalance = peak;
    this.state.maxDrawdownReached = 0;
    this.peakBalanceHistory.push({ date: new Date(), balance: peak });
    this.calculateDrawdown();
    this.updateStatus();
  }

  private handleNewPeak(newBalance: number): void {
    this.state.peakBalance = newBalance;
    this.peakBalanceHistory.push({ date: new Date(), balance: newBalance });

    // If we were in recovery mode and hit new peak, return to normal
    if (this.state.status === 'recovery' || this.state.status === 'paused') {
      this.state.status = 'normal';
      this.state.isPaused = false;
      this.state.positionReductionFactor = 1.0;

      this.addEvent({
        timestamp: new Date(),
        type: 'new-peak',
        drawdownPct: 0,
        balance: newBalance,
        peakBalance: newBalance,
        message: `New peak balance reached: $${this.round(newBalance, 2)} - returning to normal trading`
      });
    }
  }

  private calculateDrawdown(): void {
    this.state.currentDrawdown = this.state.peakBalance - this.state.currentBalance;
    this.state.currentDrawdownPct = this.state.peakBalance > 0
      ? (this.state.currentDrawdown / this.state.peakBalance) * 100
      : 0;

    // Track max drawdown reached
    if (this.state.currentDrawdownPct > this.state.maxDrawdownReached) {
      this.state.maxDrawdownReached = this.state.currentDrawdownPct;
    }
  }

  private updateStatus(): void {
    const dd = this.state.currentDrawdownPct;
    const previousStatus = this.state.status;

    // Determine new status
    if (dd >= this.config.maxDrawdown) {
      this.state.status = 'paused';
      this.state.isPaused = true;
      this.state.positionReductionFactor = 0;

      if (previousStatus !== 'paused') {
        this.addEvent({
          timestamp: new Date(),
          type: 'pause',
          drawdownPct: dd,
          balance: this.state.currentBalance,
          peakBalance: this.state.peakBalance,
          message: `Trading PAUSED - drawdown ${this.round(dd, 2)}% exceeds limit ${this.config.maxDrawdown}%`
        });
      }
    } else if (dd >= this.config.positionReductionStart) {
      this.state.status = 'reducing';
      this.state.isPaused = false;

      // Calculate reduction factor
      // Linear reduction from positionReductionStart to maxDrawdown
      const reductionRange = this.config.maxDrawdown - this.config.positionReductionStart;
      const ddInRange = dd - this.config.positionReductionStart;
      const reductionPct = (ddInRange / reductionRange) * this.config.positionReductionRate;
      this.state.positionReductionFactor = Math.max(0, 1 - reductionPct / 100);

      if (previousStatus !== 'reducing') {
        this.addEvent({
          timestamp: new Date(),
          type: 'reduction',
          drawdownPct: dd,
          balance: this.state.currentBalance,
          peakBalance: this.state.peakBalance,
          message: `Position reduction active - drawdown ${this.round(dd, 2)}%, reducing positions to ${this.round(this.state.positionReductionFactor * 100, 0)}%`
        });
      }
    } else if (dd >= this.config.warningDrawdown) {
      this.state.status = 'warning';
      this.state.isPaused = false;
      this.state.positionReductionFactor = 1.0;

      if (previousStatus !== 'warning') {
        this.addEvent({
          timestamp: new Date(),
          type: 'warning',
          drawdownPct: dd,
          balance: this.state.currentBalance,
          peakBalance: this.state.peakBalance,
          message: `Drawdown warning - ${this.round(dd, 2)}% drawdown detected`
        });
      }
    } else if (previousStatus === 'paused' && dd <= this.config.recoveryThreshold) {
      // Recovering from pause
      this.state.status = 'recovery';
      this.state.isPaused = false;
      this.state.positionReductionFactor = 0.5; // Start with 50% positions in recovery

      this.addEvent({
        timestamp: new Date(),
        type: 'recovery',
        drawdownPct: dd,
        balance: this.state.currentBalance,
        peakBalance: this.state.peakBalance,
        message: `Entering recovery mode - drawdown reduced to ${this.round(dd, 2)}%`
      });
    } else if (previousStatus === 'recovery' && dd < this.config.warningDrawdown) {
      // Fully recovered
      this.state.status = 'normal';
      this.state.positionReductionFactor = 1.0;
    } else if (dd < this.config.warningDrawdown) {
      this.state.status = 'normal';
      this.state.isPaused = false;
      this.state.positionReductionFactor = 1.0;
    }
  }

  private recordHistory(): void {
    this.history.push({
      date: new Date(),
      balance: this.state.currentBalance,
      peakBalance: this.state.peakBalance,
      drawdown: this.state.currentDrawdown,
      drawdownPct: this.state.currentDrawdownPct
    });

    // Keep only last 90 days of history
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    this.history = this.history.filter(h => h.date >= cutoffDate);
  }

  private addEvent(event: DrawdownEvent): void {
    this.events.push(event);

    // Keep only last 100 events
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }
  }

  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
