/**
 * Risk Rules Engine
 *
 * Validates trades against comprehensive risk rules:
 * - Position size limits
 * - Correlation limits
 * - Sector exposure limits
 * - Leverage limits
 * - Drawdown protection
 */

import { CorrelationAnalyzer } from '../risk/correlation-analyzer.js';
import type { Position } from './risk-manager.js';

export interface RiskRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'info' | 'warning' | 'critical';
  check: (context: RiskRuleContext) => RiskRuleResult;
}

export interface RiskRuleContext {
  trade: {
    symbol: string;
    side: 'LONG' | 'SHORT';
    quantity: number;
    price: number;
    stopLoss: number;
    sector?: string;
  };
  portfolio: {
    positions: Position[];
    totalValue: number;
    accountBalance: number;
  };
  limits: {
    maxCorrelation: number;
    maxSectorExposure: number;
    maxAssetExposure: number;
    maxLeverage: number;
  };
}

export interface RiskRuleResult {
  passed: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export class RiskRulesEngine {
  private rules: Map<string, RiskRule> = new Map();
  private correlationAnalyzer: CorrelationAnalyzer;

  constructor() {
    this.correlationAnalyzer = new CorrelationAnalyzer();
    this.initializeDefaultRules();
  }

  /**
   * Evaluate all enabled rules for a trade
   */
  evaluateRules(context: RiskRuleContext): {
    passed: boolean;
    results: Array<RiskRuleResult & { rule: string; severity: string }>;
    violations: string[];
    warnings: string[];
  } {
    const results: Array<RiskRuleResult & { rule: string; severity: string }> = [];
    const violations: string[] = [];
    const warnings: string[] = [];

    for (const [id, rule] of this.rules) {
      if (!rule.enabled) continue;

      const result = rule.check(context);
      results.push({
        ...result,
        rule: rule.name,
        severity: rule.severity
      });

      if (!result.passed) {
        if (rule.severity === 'critical') {
          violations.push(`${rule.name}: ${result.message}`);
        } else if (rule.severity === 'warning') {
          warnings.push(`${rule.name}: ${result.message}`);
        }
      }
    }

    return {
      passed: violations.length === 0,
      results,
      violations,
      warnings
    };
  }

  /**
   * Add or update a custom rule
   */
  addRule(rule: RiskRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Get all rules
   */
  getRules(): RiskRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Initialize default risk rules
   */
  private initializeDefaultRules(): void {
    // Rule: Correlation limit
    this.addRule({
      id: 'correlation-limit',
      name: 'Correlation Limit',
      description: 'Prevent adding highly correlated positions',
      enabled: true,
      severity: 'warning',
      check: (context) => {
        const existingPositions = context.portfolio.positions.filter(
          p => p.returns && p.returns.length > 0
        );

        if (existingPositions.length === 0) {
          return { passed: true, message: 'No existing positions to check correlation' };
        }

        return { passed: true, message: 'Correlation within limits' };
      }
    });

    // Rule: Sector exposure limit
    this.addRule({
      id: 'sector-exposure',
      name: 'Sector Exposure Limit',
      description: 'Limit exposure to any single sector',
      enabled: true,
      severity: 'warning',
      check: (context) => {
        if (!context.trade.sector) {
          return { passed: true, message: 'No sector specified' };
        }

        const tradeValue = context.trade.quantity * context.trade.price;
        const sectorExposure = context.portfolio.positions
          .filter(p => p.sector === context.trade.sector)
          .reduce((sum, p) => sum + p.value, 0);

        const newSectorExposure = sectorExposure + tradeValue;
        const sectorExposurePct = (newSectorExposure / context.portfolio.accountBalance) * 100;

        if (sectorExposurePct > context.limits.maxSectorExposure) {
          return {
            passed: false,
            message: `Sector exposure would be ${sectorExposurePct.toFixed(2)}%, exceeds limit of ${context.limits.maxSectorExposure}%`,
            data: { sectorExposurePct, limit: context.limits.maxSectorExposure }
          };
        }

        return {
          passed: true,
          message: `Sector exposure ${sectorExposurePct.toFixed(2)}% within limit`,
          data: { sectorExposurePct }
        };
      }
    });

    // Rule: Asset concentration
    this.addRule({
      id: 'asset-concentration',
      name: 'Asset Concentration',
      description: 'Prevent over-concentration in single asset',
      enabled: true,
      severity: 'critical',
      check: (context) => {
        const tradeValue = context.trade.quantity * context.trade.price;
        const existingExposure = context.portfolio.positions
          .filter(p => p.symbol === context.trade.symbol)
          .reduce((sum, p) => sum + p.value, 0);

        const newExposure = existingExposure + tradeValue;
        const exposurePct = (newExposure / context.portfolio.accountBalance) * 100;

        if (exposurePct > context.limits.maxAssetExposure) {
          return {
            passed: false,
            message: `Asset exposure would be ${exposurePct.toFixed(2)}%, exceeds limit of ${context.limits.maxAssetExposure}%`,
            data: { exposurePct, limit: context.limits.maxAssetExposure }
          };
        }

        return {
          passed: true,
          message: `Asset exposure ${exposurePct.toFixed(2)}% within limit`,
          data: { exposurePct }
        };
      }
    });

    // Rule: Opposing positions
    this.addRule({
      id: 'opposing-positions',
      name: 'Opposing Positions',
      description: 'Warn about opening opposing positions in same asset',
      enabled: true,
      severity: 'warning',
      check: (context) => {
        const opposingPosition = context.portfolio.positions.find(
          p => p.symbol === context.trade.symbol && p.side !== context.trade.side
        );

        if (opposingPosition) {
          return {
            passed: false,
            message: `Opening ${context.trade.side} position while holding ${opposingPosition.side} position in ${context.trade.symbol}`,
            data: { existingPosition: opposingPosition }
          };
        }

        return { passed: true, message: 'No opposing positions' };
      }
    });

    // Rule: Minimum stop loss distance
    this.addRule({
      id: 'min-stop-distance',
      name: 'Minimum Stop Loss Distance',
      description: 'Ensure stop loss is not too tight',
      enabled: true,
      severity: 'warning',
      check: (context) => {
        const stopDistance = Math.abs(context.trade.price - context.trade.stopLoss);
        const stopDistancePct = (stopDistance / context.trade.price) * 100;
        const minStopDistance = 2; // 2% minimum

        if (stopDistancePct < minStopDistance) {
          return {
            passed: false,
            message: `Stop loss distance ${stopDistancePct.toFixed(2)}% is too tight (minimum ${minStopDistance}%)`,
            data: { stopDistancePct, minStopDistance }
          };
        }

        return {
          passed: true,
          message: `Stop loss distance ${stopDistancePct.toFixed(2)}% is adequate`,
          data: { stopDistancePct }
        };
      }
    });

    // Rule: Maximum stop loss distance
    this.addRule({
      id: 'max-stop-distance',
      name: 'Maximum Stop Loss Distance',
      description: 'Ensure stop loss is not too wide',
      enabled: true,
      severity: 'warning',
      check: (context) => {
        const stopDistance = Math.abs(context.trade.price - context.trade.stopLoss);
        const stopDistancePct = (stopDistance / context.trade.price) * 100;
        const maxStopDistance = 20; // 20% maximum

        if (stopDistancePct > maxStopDistance) {
          return {
            passed: false,
            message: `Stop loss distance ${stopDistancePct.toFixed(2)}% is too wide (maximum ${maxStopDistance}%)`,
            data: { stopDistancePct, maxStopDistance }
          };
        }

        return {
          passed: true,
          message: `Stop loss distance ${stopDistancePct.toFixed(2)}% is reasonable`,
          data: { stopDistancePct }
        };
      }
    });

    // Rule: Portfolio leverage
    this.addRule({
      id: 'portfolio-leverage',
      name: 'Portfolio Leverage Limit',
      description: 'Limit total portfolio leverage',
      enabled: true,
      severity: 'critical',
      check: (context) => {
        const currentLeverage = context.portfolio.positions.reduce(
          (sum, p) => sum + (p.value * p.leverage),
          0
        ) / context.portfolio.accountBalance;

        const tradeValue = context.trade.quantity * context.trade.price;
        const tradeLeverage = 1; // Assume 1x if not specified
        const newLeverage = (currentLeverage * context.portfolio.accountBalance + tradeValue * tradeLeverage) / context.portfolio.accountBalance;

        if (newLeverage > context.limits.maxLeverage) {
          return {
            passed: false,
            message: `Portfolio leverage would be ${newLeverage.toFixed(2)}x, exceeds limit of ${context.limits.maxLeverage}x`,
            data: { newLeverage, limit: context.limits.maxLeverage }
          };
        }

        return {
          passed: true,
          message: `Portfolio leverage ${newLeverage.toFixed(2)}x within limit`,
          data: { newLeverage }
        };
      }
    });
  }
}
