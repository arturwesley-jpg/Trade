/**
 * Value at Risk (VaR) Calculator
 *
 * VaR represents the maximum expected loss at a given confidence level over a specific time horizon.
 * Three methods are implemented:
 * 1. Historical VaR: Based on historical returns distribution
 * 2. Parametric VaR: Assumes normal distribution of returns
 * 3. Monte Carlo VaR: Simulation-based approach
 */

export interface VaRConfig {
  confidenceLevel: number; // 0.95 or 0.99
  timeHorizon: number; // in days (1, 7, 30)
  portfolioValue: number;
}

export interface VaRResult {
  method: 'historical' | 'parametric' | 'monte-carlo';
  confidenceLevel: number;
  timeHorizon: number;
  varAmount: number; // Dollar amount at risk
  varPercentage: number; // Percentage of portfolio at risk
  portfolioValue: number;
}

export interface PositionData {
  symbol: string;
  value: number; // Current position value in USD
  returns: number[]; // Historical returns (percentage)
}

export class VaRCalculator {
  /**
   * Calculate Historical VaR
   * Uses actual historical returns to determine VaR
   */
  calculateHistoricalVaR(config: VaRConfig, returns: number[]): VaRResult {
    if (returns.length === 0) {
      return this.emptyResult('historical', config);
    }

    // Sort returns in ascending order (worst to best)
    const sortedReturns = [...returns].sort((a, b) => a - b);

    // Find the return at the confidence level
    const index = Math.floor((1 - config.confidenceLevel) * sortedReturns.length);
    const varReturn = sortedReturns[Math.max(0, index)];

    // Scale to time horizon (assuming daily returns)
    const scaledVarReturn = varReturn * Math.sqrt(config.timeHorizon);

    // Convert to dollar amount
    const varAmount = Math.abs((scaledVarReturn / 100) * config.portfolioValue);
    const varPercentage = Math.abs(scaledVarReturn);

    return {
      method: 'historical',
      confidenceLevel: config.confidenceLevel,
      timeHorizon: config.timeHorizon,
      varAmount: this.round(varAmount, 2),
      varPercentage: this.round(varPercentage, 2),
      portfolioValue: config.portfolioValue
    };
  }

  /**
   * Calculate Parametric VaR (Variance-Covariance method)
   * Assumes returns follow a normal distribution
   */
  calculateParametricVaR(config: VaRConfig, returns: number[]): VaRResult {
    if (returns.length === 0) {
      return this.emptyResult('parametric', config);
    }

    // Calculate mean and standard deviation
    const mean = this.calculateMean(returns);
    const stdDev = this.calculateStdDev(returns, mean);

    // Get z-score for confidence level
    const zScore = this.getZScore(config.confidenceLevel);

    // Calculate VaR: VaR = (mean - z * stdDev) * sqrt(timeHorizon)
    const varReturn = (mean - zScore * stdDev) * Math.sqrt(config.timeHorizon);

    // Convert to dollar amount
    const varAmount = Math.abs((varReturn / 100) * config.portfolioValue);
    const varPercentage = Math.abs(varReturn);

    return {
      method: 'parametric',
      confidenceLevel: config.confidenceLevel,
      timeHorizon: config.timeHorizon,
      varAmount: this.round(varAmount, 2),
      varPercentage: this.round(varPercentage, 2),
      portfolioValue: config.portfolioValue
    };
  }

  /**
   * Calculate Monte Carlo VaR
   * Uses simulation to generate possible future scenarios
   */
  calculateMonteCarloVaR(
    config: VaRConfig,
    returns: number[],
    simulations: number = 10000
  ): VaRResult {
    if (returns.length === 0) {
      return this.emptyResult('monte-carlo', config);
    }

    const mean = this.calculateMean(returns);
    const stdDev = this.calculateStdDev(returns, mean);

    // Generate simulated returns
    const simulatedReturns: number[] = [];

    for (let i = 0; i < simulations; i++) {
      // Generate random return using Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

      // Scale by time horizon
      const simulatedReturn = (mean + z * stdDev) * Math.sqrt(config.timeHorizon);
      simulatedReturns.push(simulatedReturn);
    }

    // Sort and find VaR
    const sortedReturns = simulatedReturns.sort((a, b) => a - b);
    const index = Math.floor((1 - config.confidenceLevel) * sortedReturns.length);
    const varReturn = sortedReturns[index];

    // Convert to dollar amount
    const varAmount = Math.abs((varReturn / 100) * config.portfolioValue);
    const varPercentage = Math.abs(varReturn);

    return {
      method: 'monte-carlo',
      confidenceLevel: config.confidenceLevel,
      timeHorizon: config.timeHorizon,
      varAmount: this.round(varAmount, 2),
      varPercentage: this.round(varPercentage, 2),
      portfolioValue: config.portfolioValue
    };
  }

  /**
   * Calculate portfolio VaR considering correlations between positions
   */
  calculatePortfolioVaR(
    config: VaRConfig,
    positions: PositionData[],
    correlationMatrix: number[][]
  ): VaRResult {
    if (positions.length === 0) {
      return this.emptyResult('parametric', config);
    }

    // Calculate individual position VaRs
    const positionVaRs: number[] = [];
    const weights: number[] = [];

    for (const position of positions) {
      const positionConfig: VaRConfig = {
        ...config,
        portfolioValue: position.value
      };
      const positionVaR = this.calculateParametricVaR(positionConfig, position.returns);
      positionVaRs.push(positionVaR.varAmount);
      weights.push(position.value / config.portfolioValue);
    }

    // Calculate portfolio VaR using correlation matrix
    // Portfolio VaR = sqrt(sum(sum(weight_i * weight_j * VaR_i * VaR_j * correlation_ij)))
    let portfolioVariance = 0;

    for (let i = 0; i < positions.length; i++) {
      for (let j = 0; j < positions.length; j++) {
        const correlation = correlationMatrix[i]?.[j] ?? (i === j ? 1 : 0);
        portfolioVariance += weights[i] * weights[j] * positionVaRs[i] * positionVaRs[j] * correlation;
      }
    }

    const portfolioVaR = Math.sqrt(portfolioVariance);
    const varPercentage = (portfolioVaR / config.portfolioValue) * 100;

    return {
      method: 'parametric',
      confidenceLevel: config.confidenceLevel,
      timeHorizon: config.timeHorizon,
      varAmount: this.round(portfolioVaR, 2),
      varPercentage: this.round(varPercentage, 2),
      portfolioValue: config.portfolioValue
    };
  }

  /**
   * Calculate VaR for multiple confidence levels and time horizons
   */
  calculateVaRMatrix(
    portfolioValue: number,
    returns: number[]
  ): {
    confidenceLevel: number;
    timeHorizon: number;
    historical: VaRResult;
    parametric: VaRResult;
    monteCarlo: VaRResult;
  }[] {
    const confidenceLevels = [0.95, 0.99];
    const timeHorizons = [1, 7, 30]; // 1 day, 1 week, 1 month
    const results: {
      confidenceLevel: number;
      timeHorizon: number;
      historical: VaRResult;
      parametric: VaRResult;
      monteCarlo: VaRResult;
    }[] = [];

    for (const confidenceLevel of confidenceLevels) {
      for (const timeHorizon of timeHorizons) {
        const config: VaRConfig = {
          confidenceLevel,
          timeHorizon,
          portfolioValue
        };

        results.push({
          confidenceLevel,
          timeHorizon,
          historical: this.calculateHistoricalVaR(config, returns),
          parametric: this.calculateParametricVaR(config, returns),
          monteCarlo: this.calculateMonteCarloVaR(config, returns)
        });
      }
    }

    return results;
  }

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private getZScore(confidenceLevel: number): number {
    // Z-scores for common confidence levels
    const zScores: Record<number, number> = {
      0.90: 1.282,
      0.95: 1.645,
      0.99: 2.326,
      0.999: 3.090
    };

    return zScores[confidenceLevel] ?? 1.645;
  }

  private emptyResult(method: 'historical' | 'parametric' | 'monte-carlo', config: VaRConfig): VaRResult {
    return {
      method,
      confidenceLevel: config.confidenceLevel,
      timeHorizon: config.timeHorizon,
      varAmount: 0,
      varPercentage: 0,
      portfolioValue: config.portfolioValue
    };
  }

  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
