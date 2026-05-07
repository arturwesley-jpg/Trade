# Signal Engine

## Objetivo

Gerar sinais auditaveis para futuros e paper trading, com explicacao e capacidade de dizer `WAIT`.

## Pesos Iniciais

- technical_score: 35%.
- market_structure_score: 15%.
- news_score: 15%.
- onchain_score: 15%.
- fundamental_score: 10%.
- fear_greed_score: 5%.
- provider_reliability_score: 5%.

## Regra De Ouro

Se `dataQualityScore < 60`, `providerDisagreementScore > 25` ou `riskScore > 75`, o sinal final deve ser `WAIT`.

## Campos Alvo Do Sinal

`symbol`, `direction`, `entry_zone`, `invalidation_price`, `stop_loss`, `take_profit_1`, `take_profit_2`, `take_profit_3`, `leverage_suggestion`, `max_leverage_allowed_by_risk`, `position_size_suggestion`, `risk_reward_ratio`, `confidence_score`, `technical_score`, `fundamental_score`, `news_score`, `onchain_score`, `fear_greed_score`, `liquidity_score`, `volatility_score`, `final_score`, `risk_level`, `explanation`, `data_sources_used`, `timestamp`, `expiry_time`.

## Implementado Agora

- `evaluateDecision` em `packages/trading-core/src/intelligence-engines.ts`.
- `computeTechnicalSnapshot` com 14 indicadores basicos.
- Teste cobrindo `WAIT` por qualidade baixa/divergencia/risco.

## Ainda Falta

- Persistir snapshots e sinais.
- Calcular entry/take/stop baseado em candles reais.
- Criar endpoints `/signals/:symbol` e `/signals/:symbol/explain`.
