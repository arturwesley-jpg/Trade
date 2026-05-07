/**
 * Portfolio Management Types
 *
 * Defines types for portfolio rebalancing, optimization, and asset allocation
 */

export interface Asset {
  symbol: string;
  targetWeight: number; // percentage (0-100)
  minWeight: number;
  maxWeight: number;
  currentWeight?: number;
  currentValue?: number;
  currentQuantity?: number;
}

export interface AllocationStrategy {
  id: string;
  name: string;
  description?: string;
  assets: Asset[];
  rebalanceThreshold: number; // percentage drift that triggers rebalancing
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly' | 'threshold';
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
}

export interface PortfolioSnapshot {
  totalValue: number;
  assets: {
    symbol: string;
    quantity: number;
    value: number;
    weight: number; // percentage
    targetWeight?: number;
    drift?: number; // percentage difference from target
  }[];
  cash: number;
  timestamp: Date;
}

export interface RebalanceTrade {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  estimatedValue: number;
  currentWeight: number;
  targetWeight: number;
  drift: number;
  priority: number; // execution priority (1 = highest)
}

export interface RebalancePlan {
  strategyId: string;
  strategyName: string;
  currentSnapshot: PortfolioSnapshot;
  trades: RebalanceTrade[];
  estimatedCost: number; // transaction fees
  estimatedTaxImpact?: number;
  totalTurnover: number; // percentage of portfolio being traded
  reason: string;
  createdAt: Date;
  status: 'PENDING' | 'APPROVED' | 'EXECUTING' | 'COMPLETED' | 'CANCELLED';
}

export interface OptimizationConstraints {
  minWeight: number; // minimum weight per asset
  maxWeight: number; // maximum weight per asset
  maxAssets?: number; // maximum number of assets
  minAssets?: number; // minimum number of assets
  allowShortSelling?: boolean;
  targetReturn?: number; // minimum expected return
  maxRisk?: number; // maximum acceptable risk (volatility)
  riskFreeRate?: number; // for Sharpe ratio calculation
}

export interface OptimizationResult {
  method: 'mpt' | 'risk-parity' | 'max-sharpe' | 'min-variance' | 'equal-weight';
  allocation: {
    symbol: string;
    weight: number;
  }[];
  expectedReturn: number;
  expectedRisk: number; // volatility
  sharpeRatio: number;
  diversificationRatio?: number;
  constraints: OptimizationConstraints;
  timestamp: Date;
}

export interface BacktestConfig {
  strategyId: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly';
  transactionCostPct: number; // percentage per trade
  slippagePct: number; // percentage slippage
}

export interface BacktestResult {
  config: BacktestConfig;
  finalValue: number;
  totalReturn: number; // percentage
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  totalCost: number;
  periodReturns: {
    date: Date;
    value: number;
    return: number;
  }[];
  rebalanceEvents: {
    date: Date;
    trades: RebalanceTrade[];
    cost: number;
  }[];
  timestamp: Date;
}

export interface TaxLotInfo {
  symbol: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: Date;
  currentPrice: number;
  unrealizedGainLoss: number;
  holdingPeriod: number; // days
  isLongTerm: boolean; // > 1 year
}

export interface TaxHarvestingOpportunity {
  symbol: string;
  quantity: number;
  unrealizedLoss: number;
  taxSavings: number;
  washSaleRisk: boolean;
  replacementSymbol?: string; // alternative asset to maintain exposure
}

export interface PortfolioMetrics {
  totalValue: number;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
  beta?: number;
  alpha?: number;
  informationRatio?: number;
  calmarRatio: number;
  diversificationRatio: number;
  concentrationRisk: number; // Herfindahl index
  timestamp: Date;
}

export interface RebalanceConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'threshold';
  thresholdPct: number; // drift threshold for threshold-based rebalancing
  minTradeValue: number; // minimum trade size in USD
  maxTurnoverPct: number; // maximum portfolio turnover per rebalance
  considerTaxes: boolean;
  considerTransactionCosts: boolean;
  transactionCostPct: number;
  taxRate?: number;
}

export interface VolatilityTarget {
  targetVolatility: number; // annualized volatility target
  lookbackPeriod: number; // days to calculate realized volatility
  rebalanceFrequency: 'daily' | 'weekly';
  minEquityWeight: number; // minimum allocation to risky assets
  maxEquityWeight: number; // maximum allocation to risky assets
}

export interface RiskParityConfig {
  assets: string[];
  targetRiskContribution?: number[]; // optional custom risk contributions
  lookbackPeriod: number; // days for covariance estimation
  minWeight: number;
  maxWeight: number;
}

export interface MPTConfig {
  assets: string[];
  expectedReturns: number[]; // annualized expected returns
  covarianceMatrix: number[][]; // covariance matrix
  riskFreeRate: number;
  constraints: OptimizationConstraints;
}
