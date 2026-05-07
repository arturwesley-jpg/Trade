/**
 * Unified Risk Management Types
 */

export interface RiskMetricsSnapshot {
  portfolioValue: number;
  totalExposure: number;
  leverage: number;
  var: number; // Value at Risk (95% confidence, 1-day)
  cvar: number; // Conditional VaR
  sharpeRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
  riskPerTrade: number;
  portfolioHeat: number; // Total risk as % of portfolio
  dailyPnL: number;
  dailyPnLPct: number;
  timestamp: string;
}

export interface RiskLimitsConfiguration {
  // Per-trade limits
  maxRiskPerTrade: number; // % of account
  maxPositionSize: number; // % of account

  // Daily limits
  maxDailyLoss: number; // USD
  maxDailyLossPct: number; // %
  maxDailyTrades: number;

  // Portfolio limits
  maxPortfolioHeat: number; // Total risk %
  maxLeverage: number;
  maxDrawdown: number; // %

  // Exposure limits
  maxAssetExposure: number; // % per asset
  maxSectorExposure: number; // % per sector
  maxCorrelatedExposure: number; // % for correlated assets

  // Drawdown protection
  warningDrawdown: number; // % warning threshold
  positionReductionStart: number; // % start reducing
  positionReductionRate: number; // % reduction rate
}

export interface TradeRiskCheck {
  approved: boolean;
  symbol: string;
  side: 'LONG' | 'SHORT';
  positionSize: number;
  riskAmount: number;
  riskPercentage: number;
  checks: {
    limit: string;
    passed: boolean;
    current: number;
    maximum: number;
    severity: 'info' | 'warning' | 'critical';
    message: string;
  }[];
  violations: string[];
  warnings: string[];
}

export interface PortfolioRiskAnalysis {
  // Diversification
  diversificationScore: number; // 0-100
  effectiveNumberOfAssets: number;
  concentrationRisk: 'low' | 'medium' | 'high';

  // Correlation
  correlationMatrix: {
    symbols: string[];
    matrix: number[][];
  };
  averageCorrelation: number;
  highlyCorrelatedPairs: {
    symbol1: string;
    symbol2: string;
    correlation: number;
  }[];

  // Risk metrics
  portfolioVolatility: number;
  portfolioBeta: number;
  var95: number;
  var99: number;
  cvar95: number;

  // Stress testing
  stressScenarios: {
    scenario: string;
    impact: number;
    impactPct: number;
  }[];

  timestamp: string;
}

export interface PositionSizingRecommendation {
  symbol: string;
  method: string;
  recommendedSize: number; // USD
  recommendedQuantity: number;
  leverage: number;
  riskAmount: number;
  riskPercentage: number;
  reasoning: string;
  alternatives: {
    method: string;
    size: number;
    quantity: number;
    reasoning: string;
  }[];
}

export interface RiskAlert {
  id: string;
  type: 'LIMIT_BREACH' | 'DRAWDOWN_WARNING' | 'CORRELATION_CHANGE' | 'CONCENTRATION_RISK';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
  acknowledged: boolean;
}

export interface StressTestScenario {
  name: string;
  description: string;
  priceChanges: {
    symbol: string;
    changePct: number;
  }[];
}

export interface StressTestResult {
  scenario: string;
  portfolioValue: number;
  portfolioChange: number;
  portfolioChangePct: number;
  positionImpacts: {
    symbol: string;
    currentValue: number;
    newValue: number;
    change: number;
    changePct: number;
  }[];
  breachedLimits: string[];
}
