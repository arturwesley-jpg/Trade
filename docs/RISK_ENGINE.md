# Risk Engine

## Objetivo

Evitar sinais ruins e impedir qualquer comportamento que pareca promessa de lucro. Se o risco for alto ou os dados forem fracos, o sistema deve recomendar `WAIT`.

## Inputs

- Volatilidade e ATR.
- Liquidez e spread.
- Profundidade do book.
- Funding e open interest.
- Leverage solicitado.
- Correlacao BTC/ETH.
- Noticias criticas.
- Eventos on-chain.
- Drawdown de estrategia.
- Divergencia e latencia dos providers.
- Falhas de API.

## Saida

- `riskScore`: 0 a 100.
- `riskLevel`: muito baixo, baixo, moderado, alto, extremo.
- `recommendedAction`: ALLOW, REDUCE_RISK ou WAIT.
- `maxLeverageAllowed`.
- `reasons`.

## Regras

- `riskScore > 75`: sinal direcional deve virar `WAIT`.
- Noticias criticas reduzem leverage.
- Provider disagreement reduz confianca.
- Stop loss e obrigatorio.
- LONG exige stop abaixo da entrada.
- Trade real fica bloqueado por `FEATURE_REAL_TRADING=false`.

## Implementado Agora

- `packages/trading-core/src/intelligence-engines.ts`: `evaluateRiskScore`.
- `packages/trading-core/src/risk-engine.ts`: validacao de stop em LONG/SHORT.
- Testes em `packages/trading-core/src/intelligence-engines.test.ts` e `risk-engine.test.ts`.
