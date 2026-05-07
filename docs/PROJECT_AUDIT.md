# Project Audit

Data: 2026-05-02.

## Resumo

O projeto atual e um monorepo TypeScript com um MVP paper-first. Ele tem API Fastify, frontend React/Vite, worker de mercado, bot Telegram e pacotes internos para exchange, shared types e trading-core. A base ja bloqueia trade real no endpoint paper, mas ainda usa estado em memoria, dados simulados no backend e um WebSocket BingX que apenas imprime ticks no console.

## Estrutura Encontrada

| Caminho | Funcao atual |
|---|---|
| `apps/api` | API Fastify com health, ticker simulado, sinais simples, posicoes, trades, audit e paper orders |
| `apps/web` | Dashboard React/Vite com telas de mercado, sinais, alertas, bot, risco e paper position |
| `apps/worker` | Processo que conecta stream BingX ou feed simulado e loga ticks |
| `apps/telegram-bot` | Bot Telegraf com comandos basicos |
| `packages/shared` | Tipos compartilhados, limites de risco e gerador de IDs |
| `packages/trading-core` | Risk engine, signal engine, paper executor, repositorio em memoria |
| `packages/exchange` | Normalizador e stream BingX |
| `infra/docker-compose.yml` | Dev local com API, web e worker |

## Stack Principal

| Area | Encontrado |
|---|---|
| Linguagem | TypeScript / Node.js |
| Backend | Fastify 5, Zod, CORS |
| Frontend | React 19, Vite |
| Bot | Telegraf |
| WebSocket | `ws`, BingX stream |
| Banco | Nenhum duravel implementado; apenas memoria |
| ORM | Nenhum |
| Fila/cache | Nenhum |
| Testes | Vitest |
| Docker | Compose dev, sem Dockerfile de producao |
| Deploy | Vercel web ja linkado localmente; Render API configurado fora do repo |

## O Que Ja Existe

- Paper trading basico com `PaperExecutor`.
- Risk guardrails basicos: simbolos permitidos, stop obrigatorio, limite de leverage, bloqueio live.
- Auditoria em memoria para ciclo de paper order.
- WebSocket BingX inicial com decode gzip e ping/pong.
- Frontend com visual avancado e endpoints de health, market, signals, positions e paper order.
- Bot Telegram com allowlist opcional.
- Testes unitarios para API, exchange normalizer, signal/risk/paper executor e view-model.

## Incompleto Ou Incorreto

- API nao recebe dados do worker; `/market/ticker` usa ticks simulados criados no boot.
- Sinal atual fabrica queda de preco usando `tick.price * 1.022`, entao nao e analise real.
- Estado e auditoria somem ao reiniciar.
- Nao ha PostgreSQL, Redis, migrations, ORM, filas, rate limiting, auth admin ou roles.
- Bot Telegram nao entende wrapper `{ data }` corretamente.
- Nao ha news, on-chain, fundamental, fear/greed duravel ou alertas push.
- Nao ha 10 indicadores tecnicos reais no backend antes desta entrega.
- `README.md` promete partes ainda inexistentes, incluindo trading real.
- `CONFIGURAR SERVIDOR PRO TRADE..md` contem token Telegram aparente; deve ser revogado.

## Reaproveitamento

- Reaproveitar `packages/trading-core` como nucleo de motores puros.
- Reaproveitar `packages/exchange` para evoluir providers e failover.
- Reaproveitar `apps/api` mantendo Fastify, mas separar rotas por dominio.
- Reaproveitar frontend atual como cockpit inicial, trocando arrays estaticos por endpoints.
- Reaproveitar Telegraf, mas adicionar roles, rate limit e parsing correto de API.

## Riscos Tecnicos

- Dados simulados podem ser confundidos com dados reais se a UI nao sinalizar claramente.
- Chaves sensiveis foram expostas em documentos e conversa; rotacao e obrigatoria.
- Render build falhou anteriormente; precisa log do dashboard ou build command adequado.
- `dist-types` e `*.tsbuildinfo` estao sujando o worktree.
- Sem persistencia nao ha historico de acerto, auditoria real ou backtesting confiavel.

## Servicos Gratuitos Ja Citados No Codigo/Docs

- BingX WebSocket.
- CoinGecko citado em docs, nao integrado no codigo.
- Render/Vercel citados em docs/deploy.
- Telegram via Telegraf.

## Servicos Gratuitos A Adicionar

- Binance WebSocket publico para market data primario.
- Bybit, OKX, Kraken como fallbacks WebSocket/REST.
- CoinGecko Demo para fundamentals e validacao lenta.
- DeFiLlama public API para TVL/stablecoins.
- Etherscan V2 e scan APIs para on-chain.
- CoinDesk/Cointelegraph/Decrypt RSS para noticias.
- Neon ou Supabase Postgres free para persistencia inicial.
- Upstash Redis free para rate limiting/cache.
