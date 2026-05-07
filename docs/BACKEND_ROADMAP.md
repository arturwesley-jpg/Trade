# Backend Roadmap - Crypto Sentinel

## Resumo

O backend atual ja entrega um MVP paper-first: API Fastify, sinais informativos, execucao paper, checagem de risco, repositorio em memoria, worker BingX/simulado e auditoria basica. O roadmap abaixo evolui o sistema sem quebrar o principio central: operacao real so entra depois de dados persistentes, reconciliacao, idempotencia, auditoria e validacao paper por tempo suficiente.

## Estado Atual

- `apps/api`: endpoints de health, ticker, sinais, posicoes, trades, audit, abrir/fechar posicao paper.
- `packages/trading-core`: risk engine, signal engine, paper executor e repositorio em memoria.
- `packages/exchange`: normalizador e WebSocket BingX.
- `apps/worker`: feed simulado ou BingX, hoje apenas loga ticks.
- Seguranca atual: live trading bloqueado, endpoint `/orders/paper` aceita apenas `mode: "paper"`, stop loss obrigatorio, max 4x em paper, sinais com `shouldExecute: false`.

## Fase 1 - Contratos e Persistencia

- Criar DTOs compartilhados em `packages/shared` para `HealthResponse`, `PaperOrderRequest`, `ApiError`, `MarketSnapshot`, `WhaleEvent`, `SentimentSnapshot` e `NewsEvent`.
- Padronizar erro da API como `{ error: { code, message, issues?, correlationId } }`.
- Trocar `InMemoryTradingRepository` por uma interface com implementacoes `InMemory` e `SQLite/Postgres`.
- Persistir order intents, posicoes, trades, audit events, market ticks e signal snapshots.
- Adicionar migrations versionadas e seed de desenvolvimento.
- Aceite: reiniciar a API nao apaga posicoes paper, trades nem auditoria.

## Fase 2 - Market Data em Tempo Real

- Fazer o worker publicar ticks em armazenamento/stream consumido pela API, em vez de apenas logar.
- Separar endpoints:
  - `GET /market/tickers`
  - `GET /market/tickers/:symbol`
  - `GET /market/history?symbol=BTC-USDT&interval=1m`
- Adicionar cache de ultimo tick por simbolo e historico OHLCV basico.
- Manter modo simulado como fallback local.
- Aceite: dashboard recebe BTC/ETH atualizados sem depender de valores hardcoded no `buildApp`.

## Fase 3 - Sinais Tecnicos

- Implementar motor de indicadores para os 10 sinais do produto: RSI, MACD, medias 50/200, Bollinger, volume, estocastico, ADX, OBV, ATR e suporte/resistencia.
- Gerar `TechnicalSignalSnapshot` por simbolo com score, confianca, racional e timestamp.
- Preservar `shouldExecute: false` ate a fase pre-live.
- Adicionar endpoints:
  - `GET /signals`
  - `GET /signals/:symbol`
  - `GET /signals/:symbol/explain`
- Aceite: cada sinal mostra racional rastreavel e dados de entrada suficientes para auditoria.

## Fase 4 - Sentimento, Noticias e Comportamento Humano

- Criar servico de ingestao para noticias e sentimento com adaptadores plugaveis.
- Normalizar eventos como `NewsEvent` e `SentimentSnapshot`.
- Calcular score agregado com pesos configuraveis: variacao de mercado, noticias, social sentiment, medo/euforia e atividade de whales.
- Endpoints:
  - `GET /sentiment/summary`
  - `GET /news/feed`
  - `GET /behavior/market-mood`
- Aceite: o frontend substitui dados demonstrativos de noticias/comportamento por dados da API.

## Fase 5 - Whales e Grandes Carteiras

- Criar modelo `WhaleEvent` para deposito em exchange, retirada, acumulacao, distribuicao e fluxo de stablecoins.
- Implementar adaptador inicial simulado e interface para fornecedor real futuro.
- Endpoints:
  - `GET /whales/events`
  - `GET /whales/summary`
  - `GET /whales/exchange-flow`
- Aceite: o dashboard exibe radar de baleias com eventos persistidos, fonte, severidade e timestamp.

## Fase 6 - Alertas e Automacao Segura

- Criar motor de alertas baseado em regras: preco, indicador, whale event, noticia, sentimento e risco.
- Persistir alertas com status `OPEN`, `ACKED`, `RESOLVED`.
- Integrar Telegram para envio seguro de alertas, nao de ordens reais.
- Endpoints:
  - `GET /alerts`
  - `POST /alerts/:id/ack`
  - `POST /alerts/rules`
- Aceite: alertas chegam no Telegram e ficam auditados na API.

## Fase 7 - Paper Trading Completo

- Adicionar PnL mark-to-market usando ultimo tick persistido.
- Suportar fechamento paper por TP/SL simulado, fechamento manual e historico de trades.
- Adicionar metricas: win rate, PnL, drawdown, profit factor, exposicao por simbolo.
- Endpoints:
  - `GET /portfolio/paper`
  - `GET /metrics/paper`
  - `POST /orders/:id/close`
- Aceite: 100 trades paper podem ser auditados com taxas, slippage simulado e relatorio de performance.

## Fase 8 - Pre-Live Gate

- Antes de qualquer ordem real:
  - confirmar endpoints oficiais BingX atuais;
  - armazenar chaves com criptografia;
  - reconciliar saldo, ordens e posicoes com exchange;
  - criar idempotencia real com exchange order IDs;
  - implementar circuit breaker de perda diaria/mensal;
  - exigir allowlist de usuario e confirmacao explicita.
- Criar `ENABLE_LIVE_TRADING=false` como default imutavel em ambiente local.
- Live trading deve ter endpoints separados de paper e testes proprios.
- Aceite: checklist pre-live bloqueia deploy real ate todos os gates estarem verdes.

## Testes e Verificacao

- Unitarios: risk engine, signal engine, indicadores, scoring de sentimento, normalizadores e repositorios.
- Integracao: API com repositorio persistente, idempotencia, erros padronizados e CORS.
- Contrato: DTOs compartilhados entre API e web.
- E2E local: API + worker simulado + web + ordem paper + posicao persistida.
- Segurança: live bloqueado por default, rejeicao de `mode: "live"` nos endpoints paper, stop loss obrigatorio e auditoria de rejeicoes.

## Ordem Recomendada

1. Contratos compartilhados e erro padronizado.
2. Persistencia duravel.
3. Worker alimentando market data real/simulado.
4. Indicadores tecnicos.
5. Sentimento/noticias/comportamento.
6. Whales/grandes carteiras.
7. Alertas Telegram.
8. Paper trading completo com metricas.
9. Checklist pre-live.
