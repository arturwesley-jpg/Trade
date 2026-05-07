# Trading Metrics Documentation

Este documento descreve o sistema de métricas avançadas implementado para análise de performance de trading.

## Visão Geral

O sistema de métricas é composto por três módulos principais:

1. **MetricsCalculator** - Métricas core de performance
2. **TimeSeriesAnalyzer** - Análise temporal e equity curve
3. **RiskAnalyzer** - Métricas de risco e position sizing

## 1. MetricsCalculator

Calcula métricas fundamentais de performance de trading.

### Uso

```typescript
import { MetricsCalculator, type TradeMetrics } from "@trade/trading-core";

const calculator = new MetricsCalculator({
  initialCapital: 10_000,
  riskFreeRate: 0.02, // 2% anual
  targetReturn: 0
});

const trades: TradeMetrics[] = [
  {
    pnl: 100,
    pnlPercentage: 1.0,
    openedAt: "2024-01-01T00:00:00Z",
    closedAt: "2024-01-01T02:00:00Z"
  }
];

const metrics = calculator.calculate(trades);
```

### Métricas Calculadas

#### Retornos
- **totalReturn**: Retorno total em valor absoluto
- **totalReturnPct**: Retorno total em percentual
- **annualizedReturn**: Retorno anualizado (ajustado por dias de trading)
- **annualizedReturnPct**: Retorno anualizado em percentual

#### Risk-Adjusted Returns

##### Sharpe Ratio
Mede o retorno ajustado ao risco total.

**Fórmula**: `(Retorno Médio - Taxa Livre de Risco) / Desvio Padrão`

- Sharpe > 1.0: Bom
- Sharpe > 2.0: Muito bom
- Sharpe > 3.0: Excelente

##### Sortino Ratio
Similar ao Sharpe, mas considera apenas volatilidade negativa (downside).

**Fórmula**: `(Retorno Médio - Taxa Livre de Risco) / Desvio Padrão Downside`

Geralmente maior que Sharpe, pois não penaliza volatilidade positiva.

##### Calmar Ratio
Relação entre retorno anualizado e máximo drawdown.

**Fórmula**: `Retorno Anualizado / Max Drawdown %`

- Calmar > 1.0: Bom
- Calmar > 3.0: Excelente

#### Drawdown

##### Max Drawdown
Maior queda de pico a vale durante o período.

**Cálculo**:
1. Identifica o pico de equity
2. Calcula a maior queda subsequente
3. Expressa em valor absoluto e percentual

##### Current Drawdown
Drawdown atual em relação ao último pico de equity.

#### Estatísticas Win/Loss

- **winRate**: Percentual de trades vencedoras
- **profitFactor**: Lucro bruto / Perda bruta
  - Profit Factor > 1.0: Lucrativo
  - Profit Factor > 2.0: Muito bom
- **averageWin**: Média de ganhos por trade vencedora
- **averageLoss**: Média de perdas por trade perdedora
- **largestWin**: Maior ganho individual
- **largestLoss**: Maior perda individual

#### Expectancy

Ganho esperado por trade.

**Fórmula**: `(Win Rate × Avg Win) + ((1 - Win Rate) × Avg Loss)`

Expectancy positiva indica sistema lucrativo a longo prazo.

#### Streaks

- **currentStreak**: Sequência atual (positivo = wins, negativo = losses)
- **longestWinStreak**: Maior sequência de vitórias
- **longestLossStreak**: Maior sequência de perdas

#### Tempo

- **averageHoldingTimeHours**: Tempo médio de duração das trades
- **tradingDays**: Dias totais de trading (primeira a última trade)

## 2. TimeSeriesAnalyzer

Analisa métricas ao longo do tempo e gera equity curve.

### Uso

```typescript
import { TimeSeriesAnalyzer } from "@trade/trading-core";

const analyzer = new TimeSeriesAnalyzer({
  initialCapital: 10_000,
  rollingWindowDays: 30,
  riskFreeRate: 0.02
});

const analytics = analyzer.analyze(trades, benchmarkReturns);
```

### Componentes

#### Equity Curve

Série temporal mostrando evolução do capital.

```typescript
interface EquityCurvePoint {
  timestamp: string;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}
```

#### Rolling Metrics

Métricas calculadas em janela móvel (padrão: 30 dias).

```typescript
interface RollingMetrics {
  timestamp: string;
  sharpeRatio: number;
  sortinoRatio: number;
  winRate: number;
  totalReturn: number;
  totalReturnPct: number;
  tradesInWindow: number;
}
```

Útil para identificar mudanças na performance ao longo do tempo.

#### Drawdown Periods

Análise detalhada de períodos de drawdown.

```typescript
interface DrawdownPeriod {
  startDate: string;
  endDate: string;
  duration: number; // dias
  maxDrawdown: number;
  maxDrawdownPct: number;
  recovered: boolean;
  recoveryDate?: string;
}
```

#### Period Returns

Retornos agregados por período (mensal/semanal).

```typescript
interface PeriodReturns {
  period: string; // "2024-01", "2024-W01"
  returns: number;
  returnsPct: number;
  trades: number;
  winRate: number;
}
```

#### Benchmark Correlation

Correlação com benchmark (ex: BTC).

```typescript
interface BenchmarkCorrelation {
  correlation: number; // -1 a 1
  beta: number; // Sensibilidade ao mercado
  alpha: number; // Retorno excedente
  trackingError: number; // Desvio do benchmark
}
```

**Interpretação**:
- **Beta < 1**: Menos volátil que mercado
- **Beta = 1**: Move com o mercado
- **Beta > 1**: Mais volátil que mercado
- **Alpha > 0**: Supera o benchmark
- **Correlation próximo de 1**: Altamente correlacionado

## 3. RiskAnalyzer

Análise de risco e recomendações de position sizing.

### Uso

```typescript
import { RiskAnalyzer } from "@trade/trading-core";

const analyzer = new RiskAnalyzer({
  initialCapital: 10_000,
  riskFreeRate: 0.02,
  confidenceLevel95: 0.95,
  confidenceLevel99: 0.99,
  kellyFractionMultiplier: 0.25 // Conservative Kelly
});

const riskMetrics = analyzer.analyze(
  trades,
  benchmarkReturns,
  currentOpenPositions
);
```

### Métricas de Risco

#### Value at Risk (VaR)

Perda máxima esperada em um dado nível de confiança.

**Método**: Historical Simulation

- **var95**: Com 95% de confiança, a perda não excederá este valor
- **var99**: Com 99% de confiança, a perda não excederá este valor

**Exemplo**: VaR95 = -$500 significa que em 95% dos casos, a perda será menor que $500.

#### Conditional VaR (CVaR)

Também conhecido como Expected Shortfall. Perda média quando VaR é excedido.

**Fórmula**: Média das perdas no tail (5% ou 1% piores casos)

CVaR é sempre maior (pior) que VaR e fornece melhor visão do risco de cauda.

#### Volatilidade

- **volatility**: Desvio padrão dos retornos
- **annualizedVolatility**: Volatilidade anualizada (× √252)
- **downsideVolatility**: Volatilidade apenas de retornos negativos
- **annualizedDownsideVolatility**: Downside volatility anualizada

#### Market Risk

- **beta**: Sensibilidade ao benchmark
- **correlation**: Correlação com benchmark

#### Exposure Analysis

- **averageExposure**: Capital médio em risco por trade
- **maxExposure**: Maior exposição histórica
- **currentExposure**: Capital atualmente em risco (posições abertas)

#### Position Sizing

##### Kelly Fraction

Tamanho ótimo de posição baseado no Kelly Criterion.

**Fórmula**: `f = (p × b - q) / b`

Onde:
- p = probabilidade de ganho
- q = probabilidade de perda
- b = razão win/loss

**Implementação**: Retorna 25% do Kelly completo (conservative Kelly) para reduzir risco.

##### Recommended Position Size

Tamanho recomendado ajustado por volatilidade.

**Cálculo**:
1. Base = Capital × Kelly Fraction
2. Ajuste por volatilidade
3. Cap em 10% do capital

##### Max Position Size

Limite máximo: 10% do capital por posição.

## 4. API Endpoints

### GET /metrics/performance

Retorna métricas gerais de performance.

**Response**:
```json
{
  "data": {
    "totalReturn": 1250.50,
    "totalReturnPct": 12.51,
    "annualizedReturn": 3500.00,
    "annualizedReturnPct": 35.00,
    "sharpeRatio": 1.85,
    "sortinoRatio": 2.34,
    "calmarRatio": 2.10,
    "maxDrawdown": 450.00,
    "maxDrawdownPct": 4.50,
    "winRate": 65.50,
    "profitFactor": 2.15,
    "expectancy": 25.50,
    "totalTrades": 150,
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Cache**: 1 minuto

### GET /metrics/risk

Retorna análise de risco.

**Response**:
```json
{
  "data": {
    "var95": -125.50,
    "var99": -245.00,
    "cvar95": -180.00,
    "cvar99": -320.00,
    "volatility": 2.50,
    "annualizedVolatility": 39.70,
    "beta": 0.85,
    "correlation": 0.72,
    "currentExposure": 1500.00,
    "kellyFraction": 0.125,
    "recommendedPositionSize": 1000.00,
    "maxPositionSize": 1000.00,
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Cache**: 1 minuto

### GET /metrics/equity-curve

Retorna dados para gráfico de equity curve.

**Response**:
```json
{
  "data": {
    "equityCurve": [
      {
        "timestamp": "2024-01-01T00:00:00Z",
        "equity": 10000.00,
        "drawdown": 0,
        "drawdownPct": 0
      },
      {
        "timestamp": "2024-01-01T02:00:00Z",
        "equity": 10100.00,
        "drawdown": 0,
        "drawdownPct": 0
      }
    ],
    "rollingMetrics": [
      {
        "timestamp": "2024-01-15T00:00:00Z",
        "sharpeRatio": 1.85,
        "sortinoRatio": 2.34,
        "winRate": 65.50,
        "totalReturn": 500.00,
        "totalReturnPct": 5.00,
        "tradesInWindow": 25
      }
    ],
    "drawdownPeriods": [
      {
        "startDate": "2024-01-10T00:00:00Z",
        "endDate": "2024-01-15T00:00:00Z",
        "duration": 5.0,
        "maxDrawdown": 450.00,
        "maxDrawdownPct": 4.50,
        "recovered": true,
        "recoveryDate": "2024-01-15T00:00:00Z"
      }
    ],
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Cache**: 1 minuto

### GET /metrics/trades-analysis

Retorna análise detalhada de trades.

**Response**:
```json
{
  "data": {
    "monthlyReturns": [
      {
        "period": "2024-01",
        "returns": 500.00,
        "returnsPct": 5.00,
        "trades": 45,
        "winRate": 66.67
      }
    ],
    "weeklyReturns": [
      {
        "period": "2024-W01",
        "returns": 125.00,
        "returnsPct": 1.25,
        "trades": 12,
        "winRate": 75.00
      }
    ],
    "symbolAnalysis": [
      {
        "symbol": "BTC-USDT",
        "totalTrades": 80,
        "totalPnl": 800.00,
        "winRate": 65.00,
        "averagePnl": 10.00
      }
    ],
    "recentTrades": [
      {
        "id": "trade-123",
        "symbol": "BTC-USDT",
        "side": "LONG",
        "pnl": 50.00,
        "pnlPercentage": 2.50,
        "openedAt": "2024-01-15T08:00:00Z",
        "closedAt": "2024-01-15T10:00:00Z"
      }
    ],
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Cache**: 1 minuto

## 5. Exemplo de Uso Completo

```typescript
import {
  MetricsCalculator,
  TimeSeriesAnalyzer,
  RiskAnalyzer,
  type TradeMetrics
} from "@trade/trading-core";

// Preparar dados
const trades: TradeMetrics[] = repository.trades().map(trade => ({
  pnl: trade.pnlUsdt,
  pnlPercentage: (trade.pnlUsdt / (trade.marginUsdt * trade.leverage)) * 100,
  openedAt: trade.openedAt,
  closedAt: trade.closedAt
}));

// 1. Métricas de Performance
const metricsCalc = new MetricsCalculator({
  initialCapital: 10_000,
  riskFreeRate: 0.02
});
const performance = metricsCalc.calculate(trades);

console.log(`Sharpe Ratio: ${performance.sharpeRatio}`);
console.log(`Win Rate: ${performance.winRate}%`);
console.log(`Max Drawdown: ${performance.maxDrawdownPct}%`);

// 2. Análise Temporal
const timeSeriesAnalyzer = new TimeSeriesAnalyzer({
  initialCapital: 10_000,
  rollingWindowDays: 30
});
const timeSeries = timeSeriesAnalyzer.analyze(trades);

console.log(`Equity Curve Points: ${timeSeries.equityCurve.length}`);
console.log(`Drawdown Periods: ${timeSeries.drawdownPeriods.length}`);

// 3. Análise de Risco
const riskAnalyzer = new RiskAnalyzer({
  initialCapital: 10_000,
  kellyFractionMultiplier: 0.25
});
const risk = riskAnalyzer.analyze(trades);

console.log(`VaR 95%: $${risk.var95}`);
console.log(`Recommended Position Size: $${risk.recommendedPositionSize}`);
console.log(`Kelly Fraction: ${risk.kellyFraction}`);
```

## 6. Boas Práticas

### Interpretação de Métricas

1. **Não confie em uma única métrica**: Use múltiplas métricas para avaliar performance
2. **Contexto importa**: Compare com benchmark e período de mercado
3. **Sample size**: Métricas são mais confiáveis com > 30 trades
4. **Regime changes**: Use rolling metrics para detectar mudanças

### Position Sizing

1. **Nunca use Kelly completo**: Sempre use fração conservadora (25%)
2. **Respeite limites**: Max 10% do capital por posição
3. **Ajuste por volatilidade**: Reduza tamanho em períodos voláteis
4. **Considere correlação**: Não concentre em ativos correlacionados

### Risk Management

1. **Monitor drawdown**: Reduza exposição se drawdown > 20%
2. **VaR como guia**: Use VaR para definir stop-loss de portfólio
3. **Diversificação**: Mantenha baixa correlação entre trades
4. **Stress testing**: Simule cenários extremos

## 7. Referências

- **Sharpe Ratio**: Sharpe, W. F. (1966). "Mutual Fund Performance"
- **Sortino Ratio**: Sortino, F. A. & Price, L. N. (1994)
- **Kelly Criterion**: Kelly, J. L. (1956). "A New Interpretation of Information Rate"
- **VaR/CVaR**: Rockafellar, R. T. & Uryasev, S. (2000)
