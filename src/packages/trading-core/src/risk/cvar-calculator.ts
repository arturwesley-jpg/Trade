/**
 * Conditional Value at Risk (CVaR) Calculator
 * Also known as Expected Shortfall (ES)
 *
 * CVaR represents the expected loss given that the loss exceeds the VaR threshold.
 * It provides a more conservative risk measure than VaR by considering the tail risk.
 */

export interface CVaRConfig {
  confidenceLevel: number; // 0.95 or 0.99
  timeHorizon: number; // in days (1, 7, 30)
  portfolioValue: number;
}

export interface CVaRResult {
  method: 'historical' | 'parametric' | 'monte-carlo';
  confidenceLevel: number;
  timeHorizon: number;
  cvarAmount: number; // Expected loss beyond VaR
  cvarPercentage: number; // Percentage of portfolio
  varAmount: number; // VaR threshold for reference
  varPercentage: number;
  portfolioValue: number;
  tailObservations: number; // Number of observations in the tail
}

export class CVaRCalculator {
  /**
   * Calculate Historical CVaR
   * Average of all losses beyond the VaR threshold
   */
  calculateHistoricalCVaR(config: CVaRConfig, returns: number[]): CVaRResult {
    if (returns.length === 0) {
      return this.emptyResult('historical', config);
    }

    // Sort returns in ascending order (worst to best)
    const sortedReturns = [...returns].sort((a, b) => a - b);

    // Find VaR threshold
    const varIndex = Math.floor((1 - config.confidenceLevel) * sortedReturns.length);
    const varReturn = sortedReturns[Math.max(0, varIndex)];

    // Calculate average of all returns beyond VaR (in the tail)
    const tailReturns = sortedReturns.slice(0, varIndex + 1);
    const avgTailReturn = tailReturns.length > 0
      ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length
      : varReturn;

    // Scale to time horizon
    const scaledVarReturn = varReturn * Math.sqrt(config.timeHorizon);
    const scaledCVarReturn = avgTailReturn * Math.sqrt(config.timeHorizon);

    // Convert to dollar amounts
    const varAmount = Math.abs((scaledVarReturn / 100) * config.portfolioValue);
    const cvarAmount = Math.abs((scaledCVarReturn / 100) * config.portfolioValue);

    return {
      method: 'historical',
      confidenceLevel: config.confidenceLevel,
      timeHorizon: config.timeHorizon,
      cvarAmount: this.round(cvarAmount, 2),
      cvarPercentage: this.round(Math.abs(scaledCVarReturn), 2),
      varAmount: this.round(varAmount, 2),
      varPercentage: this.round(Math.abs(scaledVarReturn), 2),
      portfolioValue: config.portfolioValue,
      tailObservations: tailReturns.length
    };
  }

  /**
   * Calculate Parametric CVaR
   * Assumes normal distribution and uses analytical formula
   */
  calculateParametricCVaR(config: CVaRConfig, returns: number[]): CVaRResult {
    if (returns.length === 0) {
      return this.emptyResult('parametric', config);
    }

    const mean = this.calculateMean(returns);
    const stdDev = this.calculateStdDev(returns, mean);

    // Get z-score for confidence level
    const zScore = this.getZScore(config.confidenceLevel);

    // Calculate VaR
    const varReturn = (mean - zScore * stdDev) * Math.sqrt(config.timeHorizon);

    // Calculate CVaR using analytical formula for normal distribution
    // CVaR = mean - stdDev * phi(z) / (1 - confidenceLevel)
    // where phi(z) is the standard normal PDF at z
    const phi = this.standardNormalPDF(zScore);
    const cvarReturn = (mean - stdDev * (phi / (1 - config.confidenceLevel))) * Math.sqrt(config.timeHorizon);

    // Convert to dollar amounts
    const varAmount = Math.abs((varReturn / 100) * config.portfolioValue);
    const cvarAmount = Math.abs((cvarReturn / 100) * config.portfolioValue);

    return {
      method: 'parametric',
      confidenceLevel: config.confidenceLevel,
      timeHorizon: config.timeHorizon,
      cvarAmount: this.round(cvarAmount, 2),
      cvarPercentage: this.round(Math.abs(cvarReturn), 2),
      varAmount: this.round(varAmount, 2),
      varPercentage: this.round(Math.abs(varReturn), 2),
      portfolioValue: config.portfolioValue,
      tailObservations: Math.floor((1 - config.confidenceLevel) * returns.length)
    };
  }

  /**
   * Calculate Monte Carlo CVaR
   * Uses simulation to generate scenarios and calculate expected shortfall
   */
  calculateMonteCarloCVaR(
    config: CVaRConfig,
    returns: number[],
    simulations: number = 10000
  ): CVaRResult {
    if (returns.length === 0) {
      return this.emptyResult('monte-carlo', config);
    }

    const mean = this.calculateMean(returns);
    const stdDev = this.calculateStdDev(returns, mean);

    // Generate simulated returns
    const simulatedReturns: number[] = [];

    for (let i = 0; i < simulations; i++) {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

      const simulatedReturn = (mean + z * stdDev) * Math.sqrt(config.timeHorizon);
      simulatedReturns.push(simulatedReturn);
    }

    // Sort and find VaR
    const sortedReturns = simulatedReturns.sort((a, b) => a - b);
    const varIndex = Math.floor((1 - config.confidenceLevel) * sortedReturns.length);
    const varReturn = sortedReturns[varIndex];

    // Calculate CVaR as average of tail
    const tailReturns = sortedReturns.slice(0, varIndex + 1);
    const cvarReturn = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;

    // Convert to dollar amounts
    const varAmount = Math.abs((varReturn / 100) * config.portfolioValue);
    const cvarAmount = Math.abs((cvarReturn / 100) * config.portfolioValue);

    return {
      method: 'monte-carlo',
      confidenceLevel: config.confidenceLevel,
      timeHorizon: config.timeHorizon,
      cvarAmount: this.round(cvarAmount, 2),
      cvarPercentage: this.round(Math.abs(cvarReturn), 2),
      varAmount: this.round(varAmount, 2),
      varPercentage: this.round(Math.abs(varReturn), 2),
      portfolioValue: config.portfolioValue,
      tailObservations: tailReturns.length
    };
  }

  /**
   * Calculate CVaR contribution of each position to portfolio CVaR
   * Useful for identifying which positions contribute most to tail risk
   */
  calculateCVaRContribution(
    config: CVaRConfig,
    positions: { symbol: string; value: number; returns: number[] }[]
  ): {
    symbol: string;
    cvarContribution: number;
    cvarContributionPct: number;
    marginalCVaR: number;
  }[] {
    if (positions.length === 0) return [];

    const portfolioCVaR = this.calculateHistoricalCVaR(
      config,
      this.calculatePortfolioReturns(positions, config.portfolioValue)
    );

    return positions.map(position => {
      const positionConfig: CVaRConfig = {
        ...config,
        portfolioValue: position.value
      };

      const positionCVaR = this.calculateHistoricalCVaR(positionConfig, position.returns);
      const weight = position.value / config.portfolioValue;

      // Marginal CVaR: change in portfolio CVaR per unit change in position
      const marginalCVaR = positionCVaR.cvarAmount * weight;

      // CVaR contribution: position's contribution to total portfolio CVaR
      const cvarContribution = marginalCVaR;
      const cvarContributionPct = portfolioCVaR.cvarAmount > 0
        ? (cvarContribution / portfolioCVaR.cvarAmount) * 100
        : 0;

      return {
        symbol: position.symbol,
        cvarContribution: this.round(cvarContribution, 2),
        cvarContributionPct: this.round(cvarContributionPct, 2),
        marginalCVaR: this.round(marginalCVaR, 2)
      };
    });
  }

  /**
   * Calculate CVaR ratio: CVaR / VaR
   * Higher ratio indicates more severe tail risk
   */
  calculateCVaRRatio(cvarResult: CVaRResult): number {
    if (cvarResult.varAmount === 0) return 1;
    return this.round(cvarResult.cvarAmount / cvarResult.varAmount, 2);
  }

  private calculatePortfolioReturns(
    positions: { value: number; returns: number[] }[],
    portfolioValue: number
  ): number[] {
    if (positions.length === 0) return [];

    const minLength = Math.min(...positions.map(p => p.returns.length));
    const portfolioReturns: number[] = [];

    for (let i = 0; i < minLength; i++) {
      let weightedReturn = 0;
      for (const position of positions) {
        const weight = position.value / portfolioValue;
        weightedReturn += weight * position.returns[i];
      }
      portfolioReturns.push(weightedReturn);
    }

    return portfolioReturns;
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
    const zScores: Record<number, number> = {
      0.90: 1.282,
      0.95: 1.645,
      0.99: 2.326,
      0.999: 3.090
    };
    return zScores[confidenceLevel] ?? 1.645;
  }

  private standardNormalPDF(z: number): number {
    return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  }

  private emptyResult(method: 'historical' | 'parametric' | 'monte-carlo', config: CVaRConfig): CVaRResult {
    return {
      method,
      confidenceLevel: config.confidenceLevel,
      timeHorizon: config.timeHorizon,
      cvarAmount: 0,
      cvarPercentage: 0,
      varAmount: 0,
      varPercentage: 0,
      portfolioValue: config.portfolioValue,
      tailObservations: 0
    };
  }

  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
