/**
 * Stress Testing for Portfolio Risk Management
 *
 * Tests portfolio performance under extreme market conditions:
 * - Historical scenarios (COVID crash, bear markets)
 * - Hypothetical scenarios (price shocks, volatility spikes)
 * - Sensitivity analysis
 */

export interface StressScenario {
  name: string;
  description: string;
  type: 'historical' | 'hypothetical';
  shocks: {
    symbol: string;
    priceChangePct: number; // Percentage change in price
    volatilityMultiplier?: number; // Multiplier for volatility
  }[];
}

export interface StressTestResult {
  scenario: string;
  type: 'historical' | 'hypothetical';
  portfolioValueBefore: number;
  portfolioValueAfter: number;
  pnl: number;
  pnlPct: number;
  positionImpacts: {
    symbol: string;
    valueBefore: number;
    valueAfter: number;
    pnl: number;
    pnlPct: number;
  }[];
  worstPosition: string;
  worstPositionLoss: number;
  timestamp: string;
}

export interface SensitivityAnalysis {
  symbol: string;
  baseValue: number;
  scenarios: {
    priceChangePct: number;
    portfolioValue: number;
    portfolioPnl: number;
    portfolioPnlPct: number;
  }[];
}

export interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  value: number;
  side: 'LONG' | 'SHORT';
  leverage: number;
}

export class StressTester {
  private readonly historicalScenarios: StressScenario[] = [
    {
      name: 'COVID-19 Crash (March 2020)',
      description: 'Crypto market crash during COVID-19 pandemic',
      type: 'historical',
      shocks: [
        { symbol: 'BTC-USDT', priceChangePct: -50, volatilityMultiplier: 3 },
        { symbol: 'ETH-USDT', priceChangePct: -60, volatilityMultiplier: 3.5 },
        { symbol: 'BNB-USDT', priceChangePct: -45, volatilityMultiplier: 2.8 },
        { symbol: 'SOL-USDT', priceChangePct: -65, volatilityMultiplier: 4 }
      ]
    },
    {
      name: '2022 Bear Market',
      description: 'Crypto winter following Terra/Luna collapse',
      type: 'historical',
      shocks: [
        { symbol: 'BTC-USDT', priceChangePct: -70, volatilityMultiplier: 2.5 },
        { symbol: 'ETH-USDT', priceChangePct: -75, volatilityMultiplier: 2.8 },
        { symbol: 'BNB-USDT', priceChangePct: -65, volatilityMultiplier: 2.3 },
        { symbol: 'SOL-USDT', priceChangePct: -85, volatilityMultiplier: 3.5 }
      ]
    },
    {
      name: 'FTX Collapse (November 2022)',
      description: 'Market crash following FTX bankruptcy',
      type: 'historical',
      shocks: [
        { symbol: 'BTC-USDT', priceChangePct: -25, volatilityMultiplier: 2 },
        { symbol: 'ETH-USDT', priceChangePct: -30, volatilityMultiplier: 2.2 },
        { symbol: 'BNB-USDT', priceChangePct: -20, volatilityMultiplier: 1.8 },
        { symbol: 'SOL-USDT', priceChangePct: -55, volatilityMultiplier: 3 }
      ]
    }
  ];

  private readonly hypotheticalScenarios: StressScenario[] = [
    {
      name: 'Extreme BTC Crash',
      description: 'Bitcoin drops 50% in a single day',
      type: 'hypothetical',
      shocks: [
        { symbol: 'BTC-USDT', priceChangePct: -50, volatilityMultiplier: 5 },
        { symbol: 'ETH-USDT', priceChangePct: -40, volatilityMultiplier: 4 },
        { symbol: 'BNB-USDT', priceChangePct: -35, volatilityMultiplier: 3.5 },
        { symbol: 'SOL-USDT', priceChangePct: -45, volatilityMultiplier: 4.5 }
      ]
    },
    {
      name: 'Volatility Spike',
      description: 'Market volatility increases 10x',
      type: 'hypothetical',
      shocks: [
        { symbol: 'BTC-USDT', priceChangePct: -15, volatilityMultiplier: 10 },
        { symbol: 'ETH-USDT', priceChangePct: -20, volatilityMultiplier: 10 },
        { symbol: 'BNB-USDT', priceChangePct: -18, volatilityMultiplier: 10 },
        { symbol: 'SOL-USDT', priceChangePct: -25, volatilityMultiplier: 10 }
      ]
    },
    {
      name: 'Altcoin Collapse',
      description: 'Altcoins crash while BTC remains stable',
      type: 'hypothetical',
      shocks: [
        { symbol: 'BTC-USDT', priceChangePct: -5, volatilityMultiplier: 1.2 },
        { symbol: 'ETH-USDT', priceChangePct: -60, volatilityMultiplier: 4 },
        { symbol: 'BNB-USDT', priceChangePct: -70, volatilityMultiplier: 5 },
        { symbol: 'SOL-USDT', priceChangePct: -80, volatilityMultiplier: 6 }
      ]
    },
    {
      name: 'Flash Crash',
      description: 'Sudden 30% drop across all assets',
      type: 'hypothetical',
      shocks: [
        { symbol: 'BTC-USDT', priceChangePct: -30, volatilityMultiplier: 8 },
        { symbol: 'ETH-USDT', priceChangePct: -30, volatilityMultiplier: 8 },
        { symbol: 'BNB-USDT', priceChangePct: -30, volatilityMultiplier: 8 },
        { symbol: 'SOL-USDT', priceChangePct: -30, volatilityMultiplier: 8 }
      ]
    }
  ];

  /**
   * Run stress test on portfolio
   */
  runStressTest(scenario: StressScenario, positions: Position[]): StressTestResult {
    const portfolioValueBefore = this.calculatePortfolioValue(positions);
    const positionImpacts: StressTestResult['positionImpacts'] = [];

    let portfolioValueAfter = 0;

    for (const position of positions) {
      const shock = scenario.shocks.find(s => s.symbol === position.symbol);
      const priceChangePct = shock?.priceChangePct ?? 0;

      const valueBefore = position.value;
      const newPrice = position.currentPrice * (1 + priceChangePct / 100);

      // Calculate new value considering leverage and side
      let valueAfter: number;
      if (position.side === 'LONG') {
        const pnlPct = ((newPrice - position.entryPrice) / position.entryPrice) * 100;
        const leveragedPnlPct = pnlPct * position.leverage;
        valueAfter = valueBefore * (1 + leveragedPnlPct / 100);
      } else {
        // SHORT position
        const pnlPct = ((position.entryPrice - newPrice) / position.entryPrice) * 100;
        const leveragedPnlPct = pnlPct * position.leverage;
        valueAfter = valueBefore * (1 + leveragedPnlPct / 100);
      }

      // Prevent negative values (liquidation)
      valueAfter = Math.max(0, valueAfter);

      const pnl = valueAfter - valueBefore;
      const pnlPct = valueBefore > 0 ? (pnl / valueBefore) * 100 : 0;

      positionImpacts.push({
        symbol: position.symbol,
        valueBefore: this.round(valueBefore, 2),
        valueAfter: this.round(valueAfter, 2),
        pnl: this.round(pnl, 2),
        pnlPct: this.round(pnlPct, 2)
      });

      portfolioValueAfter += valueAfter;
    }

    const portfolioPnl = portfolioValueAfter - portfolioValueBefore;
    const portfolioPnlPct = portfolioValueBefore > 0
      ? (portfolioPnl / portfolioValueBefore) * 100
      : 0;

    // Find worst performing position
    const worstImpact = positionImpacts.reduce((worst, current) =>
      current.pnl < worst.pnl ? current : worst
    , positionImpacts[0] ?? { symbol: '', pnl: 0 });

    return {
      scenario: scenario.name,
      type: scenario.type,
      portfolioValueBefore: this.round(portfolioValueBefore, 2),
      portfolioValueAfter: this.round(portfolioValueAfter, 2),
      pnl: this.round(portfolioPnl, 2),
      pnlPct: this.round(portfolioPnlPct, 2),
      positionImpacts,
      worstPosition: worstImpact.symbol,
      worstPositionLoss: this.round(worstImpact.pnl, 2),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Run all predefined stress scenarios
   */
  runAllScenarios(positions: Position[]): StressTestResult[] {
    const allScenarios = [...this.historicalScenarios, ...this.hypotheticalScenarios];
    return allScenarios.map(scenario => this.runStressTest(scenario, positions));
  }

  /**
   * Run sensitivity analysis for a specific asset
   * Tests how portfolio reacts to various price changes
   */
  runSensitivityAnalysis(
    symbol: string,
    positions: Position[],
    priceChanges: number[] = [-50, -30, -20, -10, -5, 0, 5, 10, 20, 30, 50]
  ): SensitivityAnalysis {
    const baseValue = this.calculatePortfolioValue(positions);
    const scenarios: SensitivityAnalysis['scenarios'] = [];

    for (const priceChangePct of priceChanges) {
      const scenario: StressScenario = {
        name: `${symbol} ${priceChangePct > 0 ? '+' : ''}${priceChangePct}%`,
        description: `${symbol} price changes by ${priceChangePct}%`,
        type: 'hypothetical',
        shocks: [{ symbol, priceChangePct }]
      };

      const result = this.runStressTest(scenario, positions);

      scenarios.push({
        priceChangePct,
        portfolioValue: result.portfolioValueAfter,
        portfolioPnl: result.pnl,
        portfolioPnlPct: result.pnlPct
      });
    }

    return {
      symbol,
      baseValue: this.round(baseValue, 2),
      scenarios
    };
  }

  /**
   * Create custom stress scenario
   */
  createCustomScenario(
    name: string,
    description: string,
    shocks: { symbol: string; priceChangePct: number }[]
  ): StressScenario {
    return {
      name,
      description,
      type: 'hypothetical',
      shocks
    };
  }

  /**
   * Calculate maximum drawdown under stress scenarios
   */
  calculateMaxDrawdown(stressResults: StressTestResult[]): {
    scenario: string;
    drawdown: number;
    drawdownPct: number;
  } {
    let maxDrawdown = 0;
    let maxDrawdownScenario = '';

    for (const result of stressResults) {
      if (result.pnl < maxDrawdown) {
        maxDrawdown = result.pnl;
        maxDrawdownScenario = result.scenario;
      }
    }

    const drawdownPct = stressResults[0]?.portfolioValueBefore
      ? (maxDrawdown / stressResults[0].portfolioValueBefore) * 100
      : 0;

    return {
      scenario: maxDrawdownScenario,
      drawdown: this.round(maxDrawdown, 2),
      drawdownPct: this.round(drawdownPct, 2)
    };
  }

  /**
   * Get predefined scenarios
   */
  getHistoricalScenarios(): StressScenario[] {
    return this.historicalScenarios;
  }

  getHypotheticalScenarios(): StressScenario[] {
    return this.hypotheticalScenarios;
  }

  getAllScenarios(): StressScenario[] {
    return [...this.historicalScenarios, ...this.hypotheticalScenarios];
  }

  private calculatePortfolioValue(positions: Position[]): number {
    return positions.reduce((sum, pos) => sum + pos.value, 0);
  }

  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}
