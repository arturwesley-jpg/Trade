# Sistema de Backtesting

Sistema completo de backtesting para testar estratégias de trading com dados históricos.

## Visão Geral

O sistema de backtesting permite:
- Testar estratégias com dados históricos reais
- Simular execução de trades com fees e slippage realistas
- Otimizar parâmetros de estratégia
- Comparar múltiplas estratégias
- Calcular métricas de performance detalhadas

## Arquitetura

### Componentes Principais

1. **HistoricalDataFetcher** - Busca dados históricos de exchanges
2. **BacktestEngine** - Motor de simulação de trades
3. **StrategyRunner** - Executa e compara estratégias
4. **API Endpoints** - Interface REST para backtesting

## 1. Historical Data Fetcher

Busca dados históricos de candles de múltiplas fontes.

### Uso Básico

```typescript
import { HistoricalDataFetcher } from "@trade/trading-core";

const fetcher = new HistoricalDataFetcher({
  useCache: true,
  cacheDir: ".cache/historical-data",
  bingxApiKey: process.env.BINGX_API_KEY,
  bingxApiSecret: process.env.BINGX_API_SECRET
});

const candles = await fetcher.fetchHistoricalCandles({
  symbol: "BTC-USDT",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-03-31"),
  interval: "1h"
});
```

### Fontes de Dados

- **BingX** (preferencial): Dados OHLCV completos e precisos
- **CoinGecko** (fallback): Dados de preço convertidos para OHLCV

### Timeframes Suportados

- `1m` - 1 minuto
- `5m` - 5 minutos
- `15m` - 15 minutos
- `1h` - 1 hora
- `4h` - 4 horas
- `1d` - 1 dia

### Cache

O sistema mantém cache local em JSON para evitar requisições repetidas:
- Localização padrão: `.cache/historical-data/`
- Formato: `{symbol}_{interval}_{startDate}_{endDate}.json`
- Pode ser desabilitado com `useCache: false`

## 2. Backtest Engine

Motor principal que simula execução de trades.

### Configuração

```typescript
import { BacktestEngine } from "@trade/trading-core";

const config = {
  symbol: "BTC-USDT",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-03-31"),
  initialCapital: 10000,
  feeRate: 0.001,        // 0.1% por trade
  slippageRate: 0.0005,  // 0.05% de slippage
  maxLeverage: 3,
  riskPerTrade: 2,       // 2% do capital por trade
  stopLossAtr: 1.5,      // 1.5x ATR para stop loss
  takeProfitAtr: 2.5     // 2.5x ATR para take profit
};

const engine = new BacktestEngine(config);
```

### Execução

```typescript
const metrics = await engine.run(candles, signalGenerator);
```

### Métricas Calculadas

O engine retorna métricas detalhadas:

```typescript
interface BacktestMetrics {
  // Trades
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;              // Percentual de trades vencedores
  
  // Retorno
  totalReturn: number;          // Retorno absoluto em USD
  totalReturnPct: number;       // Retorno percentual
  finalCapital: number;         // Capital final
  
  // Risco
  maxDrawdown: number;          // Maior drawdown em USD
  maxDrawdownPct: number;       // Maior drawdown em %
  sharpeRatio: number;          // Sharpe ratio anualizado
  
  // Performance
  profitFactor: number;         // Total wins / Total losses
  averageWin: number;           // Média de ganho por trade vencedor
  averageLoss: number;          // Média de perda por trade perdedor
  largestWin: number;           // Maior ganho individual
  largestLoss: number;          // Maior perda individual
  
  // Operacional
  averageHoldingPeriodHours: number;
  totalFees: number;
  
  // Detalhes
  trades: BacktestTrade[];      // Lista completa de trades
}
```

### Simulação Realista

O engine simula condições reais de trading:

1. **Fees**: Aplicados na entrada e saída de cada posição
2. **Slippage**: Simula diferença entre preço esperado e executado
3. **Stop Loss/Take Profit**: Verifica high/low de cada candle
4. **Position Sizing**: Baseado em risco e ATR
5. **Leverage**: Limitado por configuração e confiança do sinal

## 3. Strategy Runner

Executa e compara múltiplas estratégias.

### Testar Estratégia Única

```typescript
import { StrategyRunner } from "@trade/trading-core";

const runner = new StrategyRunner({
  symbol: "BTC-USDT",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-03-31"),
  interval: "1h",
  initialCapital: 10000,
  feeRate: 0.001,
  slippageRate: 0.0005,
  strategies: [strategy],
  historicalDataFetcher
});

const result = await runner.runSingleStrategy(strategy);
```

### Comparar Múltiplas Estratégias

```typescript
const strategies = [
  {
    name: "Conservative",
    description: "Baixo risco",
    parameters: {
      minConfidence: 0.7,
      maxLeverage: 2,
      riskPerTrade: 1
    }
  },
  {
    name: "Aggressive",
    description: "Alto risco",
    parameters: {
      minConfidence: 0.5,
      maxLeverage: 5,
      riskPerTrade: 3
    }
  }
];

const runner = new StrategyRunner({
  // ... config
  strategies
});

// Executar em paralelo
const results = await runner.runParallel();

// Resultados ordenados por retorno total
results.forEach(r => {
  console.log(`${r.strategyName}: ${r.metrics.totalReturnPct}%`);
});
```

### Otimização de Parâmetros

Grid search para encontrar melhores parâmetros:

```typescript
const optimizationResult = await runner.optimizeStrategy(
  baseStrategy,
  {
    parameterRanges: {
      minConfidence: [0.5, 0.6, 0.7, 0.8],
      maxLeverage: [2, 3, 4, 5],
      riskPerTrade: [1, 2, 3],
      stopLossAtr: [1.0, 1.5, 2.0],
      takeProfitAtr: [2.0, 2.5, 3.0]
    },
    optimizationMetric: "sharpeRatio" // ou "totalReturn", "winRate", "profitFactor"
  }
);

console.log("Melhores parâmetros:", optimizationResult.bestParameters);
console.log("Sharpe ratio:", optimizationResult.bestMetrics.sharpeRatio);
```

## 4. API Endpoints

### POST /backtest/run

Executa um backtest.

**Request:**

```json
{
  "symbol": "BTC-USDT",
  "startDate": "2024-01-01",
  "endDate": "2024-03-31",
  "interval": "1h",
  "initialCapital": 10000,
  "feeRate": 0.001,
  "slippageRate": 0.0005,
  "strategy": {
    "name": "My Strategy",
    "description": "Test strategy",
    "parameters": {
      "minConfidence": 0.6,
      "maxLeverage": 3,
      "riskPerTrade": 2,
      "stopLossAtr": 1.5,
      "takeProfitAtr": 2.5
    }
  }
}
```

**Response (202 Accepted):**

```json
{
  "success": true,
  "data": {
    "backtestId": "bt-1234567890-abc123",
    "status": "running"
  }
}
```

### GET /backtest/results/:id

Obtém resultados de um backtest.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "bt-1234567890-abc123",
    "status": "completed",
    "metrics": {
      "totalTrades": 45,
      "winRate": 62.22,
      "totalReturnPct": 23.45,
      "maxDrawdownPct": 8.32,
      "sharpeRatio": 1.87,
      "profitFactor": 2.15,
      "finalCapital": 12345.67
    },
    "config": { /* ... */ },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "completedAt": "2024-01-01T00:05:23.000Z"
  }
}
```

### GET /backtest/history

Lista backtests anteriores (últimos 50).

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "bt-1234567890-abc123",
      "status": "completed",
      "config": { /* ... */ },
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Exemplo Completo

Ver `examples/backtest-example.ts` para exemplo completo de uso.

```bash
# Executar exemplo
npm run build
node dist/examples/backtest-example.js
```

## Parâmetros de Estratégia

### newsScoreWeight
Peso do score de notícias (0-2). Padrão: 1.0

### onchainScoreWeight
Peso do score on-chain (0-2). Padrão: 1.0

### fundamentalScoreWeight
Peso do score fundamental (0-2). Padrão: 1.0

### fearGreedWeight
Peso do índice fear & greed (0-2). Padrão: 1.0

### minConfidence
Confiança mínima para executar trade (0-1). Padrão: 0.5

### maxLeverage
Alavancagem máxima permitida (1-10). Padrão: 3

### riskPerTrade
Percentual do capital a arriscar por trade (0.5-5). Padrão: 2

### stopLossAtr
Multiplicador de ATR para stop loss (0.5-3). Padrão: 1.5

### takeProfitAtr
Multiplicador de ATR para take profit (1-5). Padrão: 2.5

## Boas Práticas

### 1. Período de Teste

- Mínimo: 3 meses de dados
- Recomendado: 6-12 meses
- Incluir diferentes condições de mercado (bull, bear, sideways)

### 2. Validação

- Dividir dados em treino (70%) e teste (30%)
- Evitar overfitting com muitos parâmetros
- Testar em múltiplos símbolos

### 3. Métricas

Focar em:
- **Sharpe Ratio** > 1.5 (bom), > 2.0 (excelente)
- **Max Drawdown** < 20%
- **Win Rate** > 50%
- **Profit Factor** > 1.5

### 4. Realismo

- Usar fees realistas (0.1% é típico)
- Incluir slippage (0.05% é conservador)
- Limitar leverage (3x é seguro)
- Considerar liquidez do mercado

## Limitações

1. **Dados históricos**: Qualidade depende da fonte
2. **Simulação**: Não captura todos os aspectos do mercado real
3. **Overfitting**: Otimização excessiva pode não funcionar no futuro
4. **Liquidez**: Não simula impacto de grandes ordens
5. **Eventos externos**: Não considera notícias ou eventos inesperados

## Performance

- **Processamento**: ~10,000 candles/segundo
- **Cache**: Reduz tempo de testes repetidos em 90%
- **Paralelização**: Múltiplas estratégias em paralelo
- **Otimização**: Grid search pode testar centenas de combinações

## Troubleshooting

### Erro: "No historical data available"

- Verificar datas (startDate < endDate)
- Verificar símbolo (formato: "BTC-USDT")
- Verificar API keys se usando BingX

### Backtest muito lento

- Usar cache (`useCache: true`)
- Reduzir período de teste
- Usar timeframe maior (1h ao invés de 1m)
- Reduzir número de combinações na otimização

### Resultados irrealistas

- Verificar fees e slippage
- Limitar leverage
- Aumentar minConfidence
- Verificar qualidade dos dados históricos

## Próximos Passos

1. Adicionar mais fontes de dados (Binance, Bybit)
2. Implementar walk-forward analysis
3. Adicionar Monte Carlo simulation
4. Suportar múltiplos símbolos simultâneos
5. Integrar com banco de dados para persistência
6. Dashboard web para visualização de resultados
