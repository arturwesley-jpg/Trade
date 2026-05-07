/**
 * Position Sizing Algorithms
 *
 * Implements various position sizing strategies:
 * - Kelly Criterion
 * - Fixed Fractional
 * - Volatility-based sizing
 * - Risk Parity
 * - Maximum drawdown limits
 */

export interface PositionSizingConfig {
  accountBalance: number;
  riskPerTrade: number; // Percentage of account to risk per trade (e.g., 1, 2)
  maxPositionSize: number; // Maximum position size as % of account (e.g., 20)
  minPositionSize: number; // Minimum position size in USD
}

export interface PositionSizeInput {
  symbol: string;
  entryPrice: number;
  stopLoss: number;
  side: 'LONG' | 'SHORT';
  volatility?: number; // Annualized volatility (optional)
  winRate?: number; // Historical win rate (optional, for Kelly)
  avgWin?: number; // Average win percentage (optional, for Kelly)
  avgLoss?: number; // Average loss percentage (optional, for Kelly)
}

export interface PositionSizeResult {
  symbol: string;
  method: string;
  positionSize: number; // Dollar amount
  quantity: number; // Number of units
  riskAmount: number; // Dollar amount at risk
  riskPercentage: number; // Percentage of account at risk
  leverage: number;
  reasoning: string;
}

export interface RiskParityInput {
  symbol: string;
  volatility: number; // Annualized volatility
  currentPrice: number;
}

export class PositionSizer {
  /**
   * Fixed Fractional Position Sizing
   * Risk a fixed percentage of account on each trade
   */
  calculateFixedFractional(
    config: PositionSizingConfig,
    input: PositionSizeInput
  ): PositionSizeResult {
    // Calculate risk per unit
    const riskPerUnit = Math.abs(input.entryPrice - input.stopLoss);

    if (riskPerUnit === 0) {
      return this.emptyResult(input.symbol, 'fixed-fractional', 'Stop loss equals entry price');
    }

    // Calculate position size based on risk
    const riskAmount = (config.riskPerTrade / 100) * config.accountBalance;
    const quantity = Math.floor(riskAmount / riskPerUnit);
    const positionSize = quantity * input.entryPrice;

    // Apply position size limits
    const maxPositionSize = (config.maxPositionSize / 100) * config.accountBalance;

    let finalQuantity = quantity;
    let finalPositionSize = positionSize;
    let reasoning = `Risk ${config.riskPerTrade}% of account`;

    if (positionSize > maxPositionSize) {
      finalPositionSize = maxPositionSize;
      finalQuantity = Math.floor(maxPositionSize / input.entryPrice);
      reasoning += `, capped at ${config.maxPositionSize}% max position size`;
    }

    if (finalPositionSize < config.minPositionSize) {
      return this.emptyResult(input.symbol, 'fixed-fractional',
        `Position size ${this.round(finalPositionSize, 2)} below minimum ${config.minPositionSize}`);
    }

    const actualRiskAmount = finalQuantity * riskPerUnit;
    const actualRiskPercentage = (actualRiskAmount / config.accountBalance) * 100;
    const leverage = finalPositionSize / config.accountBalance;

    return {
      symbol: input.symbol,
      method: 'fixed-fractional',
      positionSize: this.round(finalPositionSize, 2),
      quantity: finalQuantity,
      riskAmount: this.round(actualRiskAmount, 2),
      riskPercentage: this.round(actualRiskPercentage, 2),
      leverage: this.round(leverage, 2),
      reasoning
    };
  }

  /**
   * Kelly Criterion Position Sizing
   * Optimal position size based on win rate and win/loss ratio
   * Formula: f = (p * b - q) / b
   * where: f = fraction to bet, p = win probability, q = loss probability, b = win/loss ratio
   */
  calculateKellyCriterion(
    config: PositionSizingConfig,
    input: PositionSizeInput,
    kellyFraction: number = 0.25 // Use fractional Kelly (25%) for safety
  ): PositionSizeResult {
    if (!input.winRate || !input.avgWin || !input.avgLoss) {
      return this.emptyResult(input.symbol, 'kelly-criterion',
        'Missing required parameters: winRate, avgWin, avgLoss');
    }

    const p = input.winRate / 100; // Win probability
    const q = 1 - p; // Loss probability
    const b = Math.abs(input.avgWin / input.avgLoss); // Win/loss ratio

    // Kelly percentage
    const kellyPct = ((p * b - q) / b) * 100;

    if (kellyPct <= 0) {
      return this.emptyResult(input.symbol, 'kelly-criterion',
        'Negative Kelly percentage - unfavorable odds');
    }

    // Apply fractional Kelly for safety
    const adjustedKellyPct = kellyPct * kellyFraction;

    // Cap at max position size
    const finalKellyPct = Math.min(adjustedKellyPct, config.maxPositionSize);

    const positionSize = (finalKellyPct / 100) * config.accountBalance;
    const quantity = Math.floor(positionSize / input.entryPrice);
    const finalPositionSize = quantity * input.entryPrice;

    if (finalPositionSize < config.minPositionSize) {
      return this.emptyResult(input.symbol, 'kelly-criterion',
        `Position size ${this.round(finalPositionSize, 2)} below minimum ${config.minPositionSize}`);
    }

    const riskPerUnit = Math.abs(input.entryPrice - input.stopLoss);
    const riskAmount = quantity * riskPerUnit;
    const riskPercentage = (riskAmount / config.accountBalance) * 100;
    const leverage = finalPositionSize / config.accountBalance;

    const reasoning = `Kelly: ${this.round(kellyPct, 2)}%, using ${kellyFraction * 100}% Kelly = ${this.round(finalKellyPct, 2)}%`;

    return {
      symbol: input.symbol,
      method: 'kelly-criterion',
      positionSize: this.round(finalPositionSize, 2),
      quantity,
      riskAmount: this.round(riskAmount, 2),
      riskPercentage: this.round(riskPercentage, 2),
      leverage: this.round(leverage, 2),
      reasoning
    };
  }

  /**
   * Volatility-Based Position Sizing
   * Adjust position size inversely to volatility
   * Higher volatility = smaller position
   */
  calculateVolatilityBased(
    config: PositionSizingConfig,
    input: PositionSizeInput,
    targetVolatility: number = 15 // Target portfolio volatility (%)
  ): PositionSizeResult {
    if (!input.volatility) {
      return this.emptyResult(input.symbol, 'volatility-based',
        'Missing required parameter: volatility');
    }

    // Calculate position size to achieve target volatility
    // Position size = (Target Vol / Asset Vol) * Account Balance
    const volatilityRatio = targetVolatility / input.volatility;
    const positionSize = Math.min(
      volatilityRatio * config.accountBalance,
      (config.maxPositionSize / 100) * config.accountBalance
    );

    const quantity = Math.floor(positionSize / input.entryPrice);
    const finalPositionSize = quantity * input.entryPrice;

    if (finalPositionSize < config.minPositionSize) {
      return this.emptyResult(input.symbol, 'volatility-based',
        `Position size ${this.round(finalPositionSize, 2)} below minimum ${config.minPositionSize}`);
    }

    const riskPerUnit = Math.abs(input.entryPrice - input.stopLoss);
    const riskAmount = quantity * riskPerUnit;
    const riskPercentage = (riskAmount / config.accountBalance) * 100;
    const leverage = finalPositionSize / config.accountBalance;

    const reasoning = `Target vol ${targetVolatility}%, asset vol ${this.round(input.volatility, 2)}%`;

    return {
      symbol: input.symbol,
      method: 'volatility-based',
      positionSize: this.round(finalPositionSize, 2),
      quantity,
      riskAmount: this.round(riskAmount, 2),
      riskPercentage: this.round(riskPercentage, 2),
      leverage: this.round(leverage, 2),
      reasoning
    };
  }

  /**
   * Risk Parity Position Sizing
   * Allocate capital so each position contributes equally to portfolio risk
   */
  calculateRiskParity(
    config: PositionSizingConfig,
    positions: RiskParityInput[]
  ): {
    symbol: string;
    positionSize: number;
    quantity: number;
    weight: number;
    riskContribution: number;
  }[] {
    if (positions.length === 0) return [];

    // Calculate inverse volatility weights
    const inverseVols = positions.map(p => 1 / p.volatility);
    const sumInverseVols = inverseVols.reduce((sum, iv) => sum + iv, 0);

    // Calculate weights (normalized inverse volatility)
    const weights = inverseVols.map(iv => iv / sumInverseVols);

    // Allocate capital based on weights
    return positions.map((position, i) => {
      const weight = weights[i];
      const positionSize = weight * config.accountBalance;
      const quantity = Math.floor(positionSize / position.currentPrice);
      const finalPositionSize = quantity * position.currentPrice;
      const riskContribution = (finalPositionSize / config.accountBalance) * position.volatility;

      return {
        symbol: position.symbol,
        positionSize: this.round(finalPositionSize, 2),
        quantity,
        weight: this.round(weight * 100, 2),
        riskContribution: this.round(riskContribution, 2)
      };
    });
  }

  /**
   * Calculate position size with maximum drawdown constraint
   * Reduces position size as drawdown increases
   */
  calculateWithDrawdownLimit(
    config: PositionSizingConfig,
    input: PositionSizeInput,
    currentDrawdown: number, // Current drawdown percentage
    maxDrawdown: number = 20 // Maximum allowed drawdown (%)
  ): PositionSizeResult {
    // Calculate base position using fixed fractional
    const baseResult = this.calculateFixedFractional(config, input);

    if (baseResult.quantity === 0) {
      return baseResult;
    }

    // Calculate drawdown adjustment factor
    // As drawdown approaches max, reduce position size
    const drawdownRatio = currentDrawdown / maxDrawdown;
    const adjustmentFactor = Math.max(0, 1 - drawdownRatio);

    // Apply adjustment
    const adjustedQuantity = Math.floor(baseResult.quantity * adjustmentFactor);
    const adjustedPositionSize = adjustedQuantity * input.entryPrice;

    if (adjustedPositionSize < config.minPositionSize) {
      return this.emptyResult(input.symbol, 'drawdown-adjusted',
        `Drawdown ${this.round(currentDrawdown, 2)}% too high, position size reduced below minimum`);
    }

    const riskPerUnit = Math.abs(input.entryPrice - input.stopLoss);
    const riskAmount = adjustedQuantity * riskPerUnit;
    const riskPercentage = (riskAmount / config.accountBalance) * 100;
    const leverage = adjustedPositionSize / config.accountBalance;

    const reasoning = `Base size reduced by ${this.round((1 - adjustmentFactor) * 100, 2)}% due to ${this.round(currentDrawdown, 2)}% drawdown`;

    return {
      symbol: input.symbol,
      method: 'drawdown-adjusted',
      positionSize: this.round(adjustedPositionSize, 2),
      quantity: adjustedQuantity,
      riskAmount: this.round(riskAmount, 2),
      riskPercentage: this.round(riskPercentage, 2),
      leverage: this.round(leverage, 2),
      reasoning
    };
  }

  /**
   * Calculate optimal position size using multiple methods
   * Returns all methods for comparison
   */
  calculateAllMethods(
    config: PositionSizingConfig,
    input: PositionSizeInput
  ): PositionSizeResult[] {
    const results: PositionSizeResult[] = [];

    // Fixed Fractional (always available)
    results.push(this.calculateFixedFractional(config, input));

    // Kelly Criterion (if data available)
    if (input.winRate && input.avgWin && input.avgLoss) {
      results.push(this.calculateKellyCriterion(config, input));
    }

    // Volatility-based (if volatility available)
    if (input.volatility) {
      results.push(this.calculateVolatilityBased(config, input));
    }

    return results.filter(r => r.quantity > 0);
  }

  private emptyResult(symbol: string, method: string, reasoning: string): PositionSizeResult {
    return {
      symbol,
      method,
      positionSize: 0,
      quantity: 0,
      riskAmount: 0,
      riskPercentage: 0,
      leverage: 0,
      reasoning
    };
  }

  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
