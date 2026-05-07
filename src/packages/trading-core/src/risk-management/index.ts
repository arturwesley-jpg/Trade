/**
 * Comprehensive Risk Management System
 *
 * Integrates all risk management components:
 * - Position sizing (Kelly, Fixed Fractional, Volatility-based)
 * - Risk metrics (VaR, CVaR, Sharpe, Drawdown)
 * - Risk rules engine (limits enforcement)
 * - Portfolio risk analysis (correlation, diversification)
 */

export * from './risk-manager.js';
export * from './portfolio-risk-analyzer.js';
export * from './risk-rules-engine.js';
export * from './types.js';

// Re-export from existing modules
export { PositionSizer } from '../risk/position-sizer.js';
export { VaRCalculator } from '../risk/var-calculator.js';
export { DrawdownMonitor } from '../risk/drawdown-monitor.js';
export { CorrelationAnalyzer } from '../risk/correlation-analyzer.js';
export { RiskLimitsEnforcer } from '../risk/risk-limits.js';
export { RiskAnalyzer } from '../metrics/risk-metrics.js';

export type { PositionSizingConfig, PositionSizeInput, PositionSizeResult } from '../risk/position-sizer.js';
export type { VaRConfig, VaRResult, PositionData } from '../risk/var-calculator.js';
export type { DrawdownConfig, DrawdownState, DrawdownEvent } from '../risk/drawdown-monitor.js';
export type { CorrelationMatrix, DiversificationMetrics } from '../risk/correlation-analyzer.js';
export type { RiskLimitsConfig, RiskLimitCheck, PortfolioRiskMetrics } from '../risk/risk-limits.js';
export type { RiskMetrics } from '../metrics/risk-metrics.js';
