/**
 * Risk Limits Enforcement
 *
 * Enforces various risk limits:
 * - Per-trade risk limit
 * - Daily loss limit
 * - Portfolio heat (total risk)
 * - Leverage limits
 * - Exposure limits by asset/sector
 */

export interface RiskLimitsConfig {
  // Per-trade limits
  maxRiskPerTrade: number; // Max % of account per trade
  maxPositionSize: number; // Max % of account per position

  // Daily limits
  maxDailyLoss: number; // Max daily loss in USD
  maxDailyLossPct: number; // Max daily loss as % of account
  maxDailyTrades: number; // Max number of trades per day

  // Portfolio limits
  maxPortfolioHeat: number; // Max total risk across all positions (%)
  maxLeverage: number; // Max portfolio leverage
  maxDrawdown: number; // Max drawdown before auto-pause (%)

  // Exposure limits
  maxAssetExposure: number; // Max exposure to single asset (%)
  maxSectorExposure: number; // Max exposure to single sector (%)
  maxCorrelatedExposure: number; // Max exposure to highly correlated assets (%)
}

export interface Position {
  symbol: string;
  value: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  quantity: number;
  side: 'LONG' | 'SHORT';
  leverage: number;
  sector?: string;
}

export interface Trade {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  price: number;
  stopLoss: number;
  timestamp: Date;
}

export interface RiskLimitCheck {
  passed: boolean;
  limit: string;
  current: number;
  maximum: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface PortfolioRiskMetrics {
  totalValue: number;
  totalRisk: number; // Total amount at risk
  portfolioHeat: number; // Total risk as % of account
  totalLeverage: number;
  currentDrawdown: number;
  dailyPnL: number;
  dailyPnLPct: number;
  dailyTrades: number;
  exposureByAsset: Map<string, number>;
  exposureBySector: Map<string, number>;
}

export class RiskLimitsEnforcer {
  private config: RiskLimitsConfig;
  private accountBalance: number;
  private startOfDayBalance: number;
  private dailyTrades: Trade[] = [];

  constructor(config: RiskLimitsConfig, accountBalance: number) {
    this.config = config;
    this.accountBalance = accountBalance;
    this.startOfDayBalance = accountBalance;
  }

  /**
   * Check if a new trade passes all risk limits
   */
  checkTradeRiskLimits(
    trade: Trade,
    currentPositions: Position[]
  ): RiskLimitCheck[] {
    const checks: RiskLimitCheck[] = [];

    // Calculate trade risk
    const tradeValue = trade.quantity * trade.price;
    const riskPerUnit = Math.abs(trade.price - trade.stopLoss);
    const tradeRisk = trade.quantity * riskPerUnit;
    const tradeRiskPct = (tradeRisk / this.accountBalance) * 100;

    // Check per-trade risk limit
    checks.push(this.checkPerTradeRisk(tradeRiskPct));

    // Check position size limit
    const positionSizePct = (tradeValue / this.accountBalance) * 100;
    checks.push(this.checkPositionSize(positionSizePct));

    // Check daily loss limit
    checks.push(this.checkDailyLoss());

    // Check daily trades limit
    checks.push(this.checkDailyTrades());

    // Check portfolio heat
    const metrics = this.calculatePortfolioMetrics(currentPositions);
    const newPortfolioHeat = metrics.portfolioHeat + tradeRiskPct;
    checks.push(this.checkPortfolioHeat(newPortfolioHeat));

    // Check leverage limit
    const newLeverage = (metrics.totalValue + tradeValue) / this.accountBalance;
    checks.push(this.checkLeverage(newLeverage));

    // Check drawdown limit
    checks.push(this.checkDrawdown(metrics.currentDrawdown));

    // Check asset exposure
    const newAssetExposure = this.calculateAssetExposure(trade.symbol, tradeValue, currentPositions);
    checks.push(this.checkAssetExposure(trade.symbol, newAssetExposure));

    return checks;
  }

  /**
   * Check if trade is allowed (all critical checks pass)
   */
  isTradeAllowed(checks: RiskLimitCheck[]): boolean {
    return !checks.some(check => !check.passed && check.severity === 'critical');
  }

  /**
   * Calculate current portfolio risk metrics
   */
  calculatePortfolioMetrics(positions: Position[]): PortfolioRiskMetrics {
    let totalValue = 0;
    let totalRisk = 0;
    const exposureByAsset = new Map<string, number>();
    const exposureBySector = new Map<string, number>();

    for (const position of positions) {
      totalValue += position.value;

      // Calculate risk for this position
      const riskPerUnit = Math.abs(position.currentPrice - position.stopLoss);
      const positionRisk = position.quantity * riskPerUnit;
      totalRisk += positionRisk;

      // Track asset exposure
      const currentAssetExposure = exposureByAsset.get(position.symbol) || 0;
      exposureByAsset.set(position.symbol, currentAssetExposure + position.value);

      // Track sector exposure
      if (position.sector) {
        const currentSectorExposure = exposureBySector.get(position.sector) || 0;
        exposureBySector.set(position.sector, currentSectorExposure + position.value);
      }
    }

    const portfolioHeat = this.accountBalance > 0 ? (totalRisk / this.accountBalance) * 100 : 0;
    const totalLeverage = this.accountBalance > 0 ? totalValue / this.accountBalance : 0;
    const currentDrawdown = this.calculateCurrentDrawdown();
    const dailyPnL = this.accountBalance - this.startOfDayBalance;
    const dailyPnLPct = this.startOfDayBalance > 0 ? (dailyPnL / this.startOfDayBalance) * 100 : 0;

    return {
      totalValue: this.round(totalValue, 2),
      totalRisk: this.round(totalRisk, 2),
      portfolioHeat: this.round(portfolioHeat, 2),
      totalLeverage: this.round(totalLeverage, 2),
      currentDrawdown: this.round(currentDrawdown, 2),
      dailyPnL: this.round(dailyPnL, 2),
      dailyPnLPct: this.round(dailyPnLPct, 2),
      dailyTrades: this.dailyTrades.length,
      exposureByAsset,
      exposureBySector
    };
  }

  /**
   * Update account balance (call at end of day or after trades)
   */
  updateAccountBalance(newBalance: number): void {
    this.accountBalance = newBalance;
  }

  /**
   * Reset daily counters (call at start of new trading day)
   */
  resetDailyCounters(): void {
    this.startOfDayBalance = this.accountBalance;
    this.dailyTrades = [];
  }

  /**
   * Record a trade (for daily limits tracking)
   */
  recordTrade(trade: Trade): void {
    this.dailyTrades.push(trade);
  }

  /**
   * Get risk limit violations
   */
  getRiskViolations(checks: RiskLimitCheck[]): RiskLimitCheck[] {
    return checks.filter(check => !check.passed);
  }

  /**
   * Get critical risk violations
   */
  getCriticalViolations(checks: RiskLimitCheck[]): RiskLimitCheck[] {
    return checks.filter(check => !check.passed && check.severity === 'critical');
  }

  private checkPerTradeRisk(riskPct: number): RiskLimitCheck {
    const passed = riskPct <= this.config.maxRiskPerTrade;
    return {
      passed,
      limit: 'per-trade-risk',
      current: this.round(riskPct, 2),
      maximum: this.config.maxRiskPerTrade,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Trade risk ${this.round(riskPct, 2)}% within limit`
        : `Trade risk ${this.round(riskPct, 2)}% exceeds limit of ${this.config.maxRiskPerTrade}%`
    };
  }

  private checkPositionSize(sizePct: number): RiskLimitCheck {
    const passed = sizePct <= this.config.maxPositionSize;
    return {
      passed,
      limit: 'position-size',
      current: this.round(sizePct, 2),
      maximum: this.config.maxPositionSize,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Position size ${this.round(sizePct, 2)}% within limit`
        : `Position size ${this.round(sizePct, 2)}% exceeds limit of ${this.config.maxPositionSize}%`
    };
  }

  private checkDailyLoss(): RiskLimitCheck {
    const dailyLoss = this.startOfDayBalance - this.accountBalance;
    const dailyLossPct = this.startOfDayBalance > 0 ? (dailyLoss / this.startOfDayBalance) * 100 : 0;

    const passedUSD = dailyLoss <= this.config.maxDailyLoss;
    const passedPct = dailyLossPct <= this.config.maxDailyLossPct;
    const passed = passedUSD && passedPct;

    return {
      passed,
      limit: 'daily-loss',
      current: this.round(dailyLoss, 2),
      maximum: this.config.maxDailyLoss,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Daily loss ${this.round(dailyLoss, 2)} (${this.round(dailyLossPct, 2)}%) within limits`
        : `Daily loss ${this.round(dailyLoss, 2)} (${this.round(dailyLossPct, 2)}%) exceeds limits`
    };
  }

  private checkDailyTrades(): RiskLimitCheck {
    const passed = this.dailyTrades.length < this.config.maxDailyTrades;
    return {
      passed,
      limit: 'daily-trades',
      current: this.dailyTrades.length,
      maximum: this.config.maxDailyTrades,
      severity: passed ? 'info' : 'warning',
      message: passed
        ? `Daily trades ${this.dailyTrades.length} within limit`
        : `Daily trades ${this.dailyTrades.length} exceeds limit of ${this.config.maxDailyTrades}`
    };
  }

  private checkPortfolioHeat(heat: number): RiskLimitCheck {
    const passed = heat <= this.config.maxPortfolioHeat;
    return {
      passed,
      limit: 'portfolio-heat',
      current: this.round(heat, 2),
      maximum: this.config.maxPortfolioHeat,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Portfolio heat ${this.round(heat, 2)}% within limit`
        : `Portfolio heat ${this.round(heat, 2)}% exceeds limit of ${this.config.maxPortfolioHeat}%`
    };
  }

  private checkLeverage(leverage: number): RiskLimitCheck {
    const passed = leverage <= this.config.maxLeverage;
    return {
      passed,
      limit: 'leverage',
      current: this.round(leverage, 2),
      maximum: this.config.maxLeverage,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Leverage ${this.round(leverage, 2)}x within limit`
        : `Leverage ${this.round(leverage, 2)}x exceeds limit of ${this.config.maxLeverage}x`
    };
  }

  private checkDrawdown(drawdown: number): RiskLimitCheck {
    const passed = drawdown <= this.config.maxDrawdown;
    return {
      passed,
      limit: 'drawdown',
      current: this.round(drawdown, 2),
      maximum: this.config.maxDrawdown,
      severity: passed ? 'info' : 'critical',
      message: passed
        ? `Drawdown ${this.round(drawdown, 2)}% within limit`
        : `Drawdown ${this.round(drawdown, 2)}% exceeds limit of ${this.config.maxDrawdown}% - trading paused`
    };
  }

  private checkAssetExposure(symbol: string, exposure: number): RiskLimitCheck {
    const exposurePct = (exposure / this.accountBalance) * 100;
    const passed = exposurePct <= this.config.maxAssetExposure;
    return {
      passed,
      limit: 'asset-exposure',
      current: this.round(exposurePct, 2),
      maximum: this.config.maxAssetExposure,
      severity: passed ? 'info' : 'warning',
      message: passed
        ? `${symbol} exposure ${this.round(exposurePct, 2)}% within limit`
        : `${symbol} exposure ${this.round(exposurePct, 2)}% exceeds limit of ${this.config.maxAssetExposure}%`
    };
  }

  private calculateAssetExposure(symbol: string, newValue: number, positions: Position[]): number {
    const existingExposure = positions
      .filter(p => p.symbol === symbol)
      .reduce((sum, p) => sum + p.value, 0);
    return existingExposure + newValue;
  }

  private calculateCurrentDrawdown(): number {
    // This would typically track peak balance and calculate drawdown from peak
    // For now, simplified version
    const peakBalance = Math.max(this.startOfDayBalance, this.accountBalance);
    const drawdown = peakBalance > 0 ? ((peakBalance - this.accountBalance) / peakBalance) * 100 : 0;
    return Math.max(0, drawdown);
  }

  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
