# Backtesting System - Quick Start

## Instalação

```bash
npm install
npm run build
```

## Uso Rápido

### 1. Via API

```bash
# Iniciar API
npm run dev:api

# Executar backtest
curl -X POST http://localhost:3000/backtest/run \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC-USDT",
    "startDate": "2024-01-01",
    "endDate": "2024-03-31",
    "interval": "1h",
    "initialCapital": 10000,
    "strategy": {
      "name": "My Strategy",
      "parameters": {
        "minConfidence": 0.6,
        "maxLeverage": 3,
        "riskPerTrade": 2
      }
    }
  }'

# Ver resultados
curl http://localhost:3000/backtest/results/{backtestId}

# Ver histórico
curl http://localhost:3000/backtest/history
```

### 2. Via Código

```typescript
import { HistoricalDataFetcher, StrategyRunner } from "@trade/trading-core";

const fetcher = new HistoricalDataFetcher({ useCache: true });

const runner = new StrategyRunner({
  symbol: "BTC-USDT",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-03-31"),
  interval: "1h",
  initialCapital: 10000,
  feeRate: 0.001,
  slippageRate: 0.0005,
  strategies: [{
    name: "Test Strategy",
    parameters: {
      minConfidence: 0.6,
      maxLeverage: 3,
      riskPerTrade: 2
    }
  }],
  historicalDataFetcher: fetcher
});

const results = await runner.runParallel();
console.log(results[0].metrics);
```

## Endpoints da API

- `POST /backtest/run` - Executar backtest
- `GET /backtest/results/:id` - Ver resultados
- `GET /backtest/history` - Listar backtests

## Documentação Completa

Ver `docs/BACKTESTING.md` para documentação detalhada.

## Testes

```bash
npm test -- backtesting
```

## Arquivos Principais

- `packages/trading-core/src/backtesting/historical-data-fetcher.ts` - Busca dados históricos
- `packages/trading-core/src/backtesting/backtest-engine.ts` - Motor de simulação
- `packages/trading-core/src/backtesting/strategy-runner.ts` - Executa estratégias
- `apps/api/src/app.ts` - Endpoints REST
- `examples/backtest-example.ts` - Exemplo completo
