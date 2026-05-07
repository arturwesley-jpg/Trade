/**
 * Correlation Analysis for Portfolio Risk Management
 *
 * Analyzes correlations between assets to:
 * - Identify diversification opportunities
 * - Detect concentration risk
 * - Monitor correlation breakdown during stress periods
 */

export interface CorrelationConfig {
  rollingWindow?: number; // Days for rolling correlation (default: 30)
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][]; // Correlation coefficients [-1, 1]
  timestamp: string;
}

export interface RollingCorrelation {
  symbol1: string;
  symbol2: string;
  correlations: {
    date: string;
    correlation: number;
  }[];
  current: number;
  average: number;
  min: number;
  max: number;
  stdDev: number;
}

export interface DiversificationMetrics {
  portfolioDiversificationRatio: number; // 0-1, higher is better
  effectiveNumberOfAssets: number; // Effective N considering correlations
  concentrationRisk: 'low' | 'medium' | 'high';
  averageCorrelation: number;
  maxCorrelation: number;
  minCorrelation: number;
  highlyCorrelatedPairs: { symbol1: string; symbol2: string; correlation: number }[];
}

export interface CorrelationBreakdown {
  detected: boolean;
  symbol1: string;
  symbol2: string;
  normalCorrelation: number;
  currentCorrelation: number;
  change: number;
  severity: 'low' | 'medium' | 'high';
}

export class CorrelationAnalyzer {
  /**
   * Calculate correlation matrix between multiple assets
   */
  calculateCorrelationMatrix(
    positions: { symbol: string; returns: number[] }[]
  ): CorrelationMatrix {
    const symbols = positions.map(p => p.symbol);
    const n = symbols.length;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          matrix[i][j] = this.calculateCorrelation(
            positions[i].returns,
            positions[j].returns
          );
        }
      }
    }

    return {
      symbols,
      matrix,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate correlation between two return series
   */
  calculateCorrelation(returns1: number[], returns2: number[]): number {
    const n = Math.min(returns1.length, returns2.length);
    if (n === 0) return 0;

    const x = returns1.slice(0, n);
    const y = returns2.slice(0, n);

    const meanX = this.calculateMean(x);
    const meanY = this.calculateMean(y);

    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - meanX;
      const yDiff = y[i] - meanY;
      numerator += xDiff * yDiff;
      sumXSquared += xDiff * xDiff;
      sumYSquared += yDiff * yDiff;
    }

    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator !== 0 ? numerator / denominator : 0;
  }

  /**
   * Calculate rolling correlation over time
   */
  calculateRollingCorrelation(
    symbol1: string,
    returns1: number[],
    symbol2: string,
    returns2: number[],
    window: number = 30
  ): RollingCorrelation {
    const n = Math.min(returns1.length, returns2.length);
    const correlations: { date: string; correlation: number }[] = [];

    for (let i = window; i <= n; i++) {
      const windowReturns1 = returns1.slice(i - window, i);
      const windowReturns2 = returns2.slice(i - window, i);
      const correlation = this.calculateCorrelation(windowReturns1, windowReturns2);

      correlations.push({
        date: new Date(Date.now() - (n - i) * 24 * 60 * 60 * 1000).toISOString(),
        correlation: this.round(correlation, 3)
      });
    }

    const correlationValues = correlations.map(c => c.correlation);
    const current = correlationValues[correlationValues.length - 1] ?? 0;
    const average = this.calculateMean(correlationValues);
    const min = Math.min(...correlationValues);
    const max = Math.max(...correlationValues);
    const stdDev = this.calculateStdDev(correlationValues, average);

    return {
      symbol1,
      symbol2,
      correlations,
      current: this.round(current, 3),
      average: this.round(average, 3),
      min: this.round(min, 3),
      max: this.round(max, 3),
      stdDev: this.round(stdDev, 3)
    };
  }

  /**
   * Calculate diversification metrics for the portfolio
   */
  calculateDiversificationMetrics(
    correlationMatrix: CorrelationMatrix,
    weights: number[]
  ): DiversificationMetrics {
    const n = correlationMatrix.symbols.length;

    if (n === 0) {
      return {
        portfolioDiversificationRatio: 0,
        effectiveNumberOfAssets: 0,
        concentrationRisk: 'high',
        averageCorrelation: 0,
        maxCorrelation: 0,
        minCorrelation: 0,
        highlyCorrelatedPairs: []
      };
    }

    // Calculate average correlation (excluding diagonal)
    let sumCorrelation = 0;
    let count = 0;
    let maxCorrelation = -1;
    let minCorrelation = 1;
    const highlyCorrelatedPairs: { symbol1: string; symbol2: string; correlation: number }[] = [];

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const corr = correlationMatrix.matrix[i][j];
        sumCorrelation += corr;
        count++;

        if (corr > maxCorrelation) maxCorrelation = corr;
        if (corr < minCorrelation) minCorrelation = corr;

        // Flag highly correlated pairs (> 0.7)
        if (corr > 0.7) {
          highlyCorrelatedPairs.push({
            symbol1: correlationMatrix.symbols[i],
            symbol2: correlationMatrix.symbols[j],
            correlation: this.round(corr, 3)
          });
        }
      }
    }

    const averageCorrelation = count > 0 ? sumCorrelation / count : 0;

    // Calculate portfolio variance
    let portfolioVariance = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        portfolioVariance += weights[i] * weights[j] * correlationMatrix.matrix[i][j];
      }
    }

    // Calculate weighted average variance (assuming unit variance for simplicity)
    const weightedAvgVariance = weights.reduce((sum, w) => sum + w * w, 0);

    // Portfolio Diversification Ratio = sqrt(weighted avg variance / portfolio variance)
    const diversificationRatio = portfolioVariance > 0
      ? Math.sqrt(weightedAvgVariance / portfolioVariance)
      : 0;

    // Effective Number of Assets (Herfindahl index approach)
    const herfindahlIndex = weights.reduce((sum, w) => sum + w * w, 0);
    const effectiveNumberOfAssets = herfindahlIndex > 0 ? 1 / herfindahlIndex : 0;

    // Determine concentration risk
    let concentrationRisk: 'low' | 'medium' | 'high';
    if (effectiveNumberOfAssets >= 5 && averageCorrelation < 0.5) {
      concentrationRisk = 'low';
    } else if (effectiveNumberOfAssets >= 3 && averageCorrelation < 0.7) {
      concentrationRisk = 'medium';
    } else {
      concentrationRisk = 'high';
    }

    return {
      portfolioDiversificationRatio: this.round(diversificationRatio, 3),
      effectiveNumberOfAssets: this.round(effectiveNumberOfAssets, 2),
      concentrationRisk,
      averageCorrelation: this.round(averageCorrelation, 3),
      maxCorrelation: this.round(maxCorrelation, 3),
      minCorrelation: this.round(minCorrelation, 3),
      highlyCorrelatedPairs
    };
  }

  /**
   * Detect correlation breakdown (when correlations change significantly)
   * Useful for identifying regime changes or stress periods
   */
  detectCorrelationBreakdown(
    rollingCorrelation: RollingCorrelation,
    threshold: number = 2.0 // Standard deviations
  ): CorrelationBreakdown {
    const change = rollingCorrelation.current - rollingCorrelation.average;
    const changeInStdDevs = rollingCorrelation.stdDev > 0
      ? Math.abs(change) / rollingCorrelation.stdDev
      : 0;

    const detected = changeInStdDevs > threshold;

    let severity: 'low' | 'medium' | 'high';
    if (changeInStdDevs > 3) {
      severity = 'high';
    } else if (changeInStdDevs > 2) {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    return {
      detected,
      symbol1: rollingCorrelation.symbol1,
      symbol2: rollingCorrelation.symbol2,
      normalCorrelation: rollingCorrelation.average,
      currentCorrelation: rollingCorrelation.current,
      change: this.round(change, 3),
      severity
    };
  }

  /**
   * Calculate correlation with multiple time windows
   */
  calculateMultiPeriodCorrelations(
    symbol1: string,
    returns1: number[],
    symbol2: string,
    returns2: number[]
  ): {
    period: string;
    days: number;
    correlation: number;
  }[] {
    const periods = [
      { label: '30d', days: 30 },
      { label: '90d', days: 90 },
      { label: '180d', days: 180 },
      { label: 'all', days: Math.min(returns1.length, returns2.length) }
    ];

    return periods.map(period => {
      const n = Math.min(returns1.length, returns2.length, period.days);
      const recentReturns1 = returns1.slice(-n);
      const recentReturns2 = returns2.slice(-n);

      return {
        period: period.label,
        days: n,
        correlation: this.round(this.calculateCorrelation(recentReturns1, recentReturns2), 3)
      };
    });
  }

  /**
   * Find assets with low correlation for diversification
   */
  findDiversificationOpportunities(
    correlationMatrix: CorrelationMatrix,
    threshold: number = 0.3
  ): { symbol1: string; symbol2: string; correlation: number }[] {
    const opportunities: { symbol1: string; symbol2: string; correlation: number }[] = [];
    const n = correlationMatrix.symbols.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const corr = correlationMatrix.matrix[i][j];
        if (Math.abs(corr) < threshold) {
          opportunities.push({
            symbol1: correlationMatrix.symbols[i],
            symbol2: correlationMatrix.symbols[j],
            correlation: this.round(corr, 3)
          });
        }
      }
    }

    // Sort by absolute correlation (lowest first)
    return opportunities.sort((a, b) => Math.abs(a.correlation) - Math.abs(b.correlation));
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

  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
