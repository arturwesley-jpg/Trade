# Free Services Matrix

Verificacao feita em 2026-05-02 com fontes oficiais quando possivel. Quando o termo comercial nao ficou claro, a linha marca confirmacao manual.

| Servico | Categoria | Gratuito? | API key? | Cartao? | WebSocket? | Limites | Melhor uso | Risco | Fallback | Ja existe no codigo? | Arquivos | Como configurar |
|---|---|---:|---:|---:|---:|---|---|---|---|---:|---|---|
| Binance public WS | Market data | Sim | Nao para publico | Nao | Sim | Spot docs indicam 5 msg/s, 1024 streams/conn, 300 conexoes/5min/IP | Primario para trades/ticker/candles/book | Bloqueio regional/limites | Bybit | Nao | N/A | `MARKET_PROVIDER_PRIMARY=binance` |
| Bybit public WS | Market data/futuros | Sim | Nao para publico | Nao | Sim | Docs indicam orderbook 10ms-200ms por profundidade | Fallback 1, bom para perp/linear | Termos de uso precisam revisao comercial | OKX | Nao | N/A | `MARKET_PROVIDER_FALLBACK_1=bybit` |
| OKX public WS | Market data/futuros | Sim | Nao para publico | Nao | Sim | Docs indicam 3 conexoes/s/IP e 480 subscribe/unsubscribe/login por hora/conexao | Fallback 2 e mark/funding | Regiao/termos | Kraken | Nao | N/A | `MARKET_PROVIDER_FALLBACK_2=okx` |
| Kraken public WS | Market data | Sim | Nao para publico | Nao | Sim | Public feeds sem auth; limites exatos exigem leitura por endpoint | Fallback 3 regulado | Menos pares alt/perp | Coinbase | Nao | N/A | `MARKET_PROVIDER_FALLBACK_3=kraken` |
| BingX public WS | Market data/futuros | Sim | Nao para publico | Nao | Sim | Verificado por docs publicas do repo BingX; confirmar limites atuais | Fonte ja iniciada no codigo | Endpoint atual estava inconsistente | Binance | Sim | `packages/exchange`, `apps/worker` | `BINGX_WS_URL=wss://open-api-swap.bingx.com/swap-market` |
| Coinbase Exchange WS | Market data | Sim | Nao para feed publico | Nao | Sim | Help menciona 10 subscriptions por product/channel em contas Exchange | Validacao spot BTC/ETH/USD | Menos futuros | Kraken | Nao | N/A | `COINBASE_API_KEY` opcional |
| CoinGecko Demo | Market/fundamental | Sim | Sim | Nao | Nao no demo | 10k calls/mes, 30/min, data freshness 60s | Validador lento e fundamentals | Atribuicao/licenca/comercial precisa confirmar | CryptoCompare | Citado docs | `README.md` | `COINGECKO_API_KEY=` |
| CryptoCompare | Market/news | Free tier | Sim | Precisa confirmar | Nao principal | Nao verificado totalmente nesta sessao | Fallback REST | Precisa confirmar plano | CoinGecko | Nao | N/A | `CRYPTOCOMPARE_API_KEY=` |
| CoinDesk RSS | Noticias | Sim | Nao | Nao | Nao | RSS oficial publica feed completo | Noticias fortes | Termos de redistribuicao | Cointelegraph | Nao | N/A | URL no news worker |
| Cointelegraph RSS | Noticias | Sim | Nao | Nao | Nao | RSS oficial por categorias | Noticias/regulacao | Termos RSS | Decrypt | Nao | N/A | URL no news worker |
| Decrypt RSS | Noticias | Sim | Nao | Nao | Nao | Feed precisa confirmacao manual por URL oficial | Web3/cultura/mercado | Confirmar URL/termos | CoinDesk | Nao | N/A | URL no news worker |
| DeFiLlama API | Fundamental/on-chain | Sim | Nao para publico | Nao | Nao | Public API; Pro para maior volume | TVL, stablecoins, fees | Sem SLA free | CoinGecko | Nao | N/A | Sem key inicial |
| Etherscan V2 | On-chain | Sim | Sim | Nao | Nao | Free: 3 calls/s, 100k/dia, chains selecionadas | ETH whales e contratos | Attribution/limites | RPC publicos | Nao | N/A | `ETHERSCAN_API_KEY=` |
| BscScan | On-chain | Sim | Sim | Nao | Nao | 5 calls/s com key | BSC whales | V1/V2 migracoes | Etherscan V2 | Nao | N/A | `BSCSCAN_API_KEY=` |
| PolygonScan | On-chain | Sim | Sim | Nao | Nao | 5 calls/s, 100k/dia citado em docs/info | Polygon whales | Attribution/limites | Etherscan V2 | Nao | N/A | `POLYGONSCAN_API_KEY=` |
| Neon | Postgres | Sim | Nao para local, conta cloud | Nao | N/A | Free: 0.5GB/projeto, 100 CU-h/projeto/mes | Banco inicial | Scale-to-zero/limite storage | Supabase | Nao | N/A | `DATABASE_URL=` |
| Supabase | Postgres/Auth | Sim | Conta | Nao para free basico | Realtime sim | Free docs: 2 projetos; limites detalhados na pricing | DB + Auth futuro | Projetos pausam/limites | Neon | Nao | N/A | `DATABASE_URL=` |
| Upstash Redis | Redis/cache | Sim | Sim | Nao | N/A | Free: 256MB, 500k commands/mes, 1 DB | Rate limit/cache | Limite mensal | Redis local | Nao | N/A | `REDIS_URL=` |
| Render | Deploy API | Sim para teste | Conta | Nao para free | N/A | Free services com limitacoes; nao usar prod | API hobby | Dorme/falha em prod | Fly/VPS | Externo | docs deploy | Dashboard Render |
| Vercel | Frontend | Sim | Conta | Nao para hobby | N/A | Ver pricing atual antes de comercial | Frontend | Env errada aponta localhost | Cloudflare Pages | Sim | `apps/web/.vercel` local | `VITE_API_BASE_URL=` |
| UptimeRobot | Observabilidade | Sim | Conta | Nao | N/A | Free: 50 monitores, 5 min | Health checks | Intervalo lento | Better Stack | Nao | N/A | Monitorar `/health` |

## Itens Pedidos Que Precisam Confirmacao Manual Antes De Producao

| Servico | Categoria | Status nesta auditoria |
|---|---|---|
| CoinMarketCap | Market/fundamental | Nao consegui verificar limites/free tier atuais nesta sessao. |
| CCXT | Biblioteca multi-exchange | Nao e servico; deve ser avaliada como dependencia futura para REST, nao para WebSocket principal. |
| TradingView | Graficos/indicadores | Nao consegui confirmar uso API/licenca para backend de sinais. Usar apenas UI/widget se termos permitirem. |
| NewsAPI | Noticias | Nao consegui confirmar permissao para crypto/comercial; precisa revisar plano e termos. |
| The Block | Noticias | Nao consegui confirmar RSS/API livre e termos. |
| CryptoSlate | Noticias | Nao consegui confirmar RSS/API livre e termos. |
| Bitcoin Magazine | Noticias | Nao consegui confirmar RSS/API livre e termos. |
| Token Terminal | Fundamental | Precisa confirmar free tier util e termos. |
| Dune | On-chain | Precisa confirmar free tier, limites e uso comercial. |
| Solscan/Solana APIs | On-chain | Precisa confirmar API publica, limites e termos atuais. |
| Whale Alert | Whale tracking | Precisa confirmar plano gratuito atual e limites. |
| Turso | Banco edge SQLite | Precisa confirmar free tier atual e adequacao para series temporais. |
| Railway | Deploy | Precisa confirmar se ainda ha trial/free aplicavel. |
| Fly.io | Deploy | Precisa confirmar allowance/free atual e necessidade de cartao. |
| Netlify | Frontend | Precisa confirmar limites atuais; alternativa a Vercel/Cloudflare Pages. |
| Cloudflare Pages | Frontend | Free plan verificado parcialmente: 500 builds/mes e 20k files/site em docs. |
| Sentry | Observabilidade | Precisa confirmar free tier atual; recomendado para erros frontend/API depois. |
| Grafana/Prometheus local | Observabilidade | Gratuito self-host; recomendado local/VPS, sem SaaS necessario. |

## Fontes Verificadas

- Binance WebSocket docs: https://deepwiki.com/binance/binance-spot-api-docs/4-websocket-streams
- Bybit WebSocket docs: https://bybit-exchange.github.io/docs/v5/ws/connect
- OKX WebSocket docs: https://www.okx.com/docs-v5/en/
- Kraken WebSocket docs: https://docs.kraken.com/websockets-v2/
- Coinbase WebSocket docs: https://docs.cdp.coinbase.com/exchange/websocket-feed
- CoinGecko pricing: https://www.coingecko.com/en/api/pricing
- Neon pricing: https://neon.com/pricing
- Render free docs: https://render.com/docs/free
- Upstash pricing: https://upstash.com/docs/redis/overall/pricing
- Etherscan limits: https://docs.etherscan.io/resources/rate-limits
- UptimeRobot pricing: https://uptimerobot.com/pricing/
