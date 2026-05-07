# Market Data Providers

## Recomendacao

Principal: Binance public WebSocket para market data agregado inicial.

Fallbacks:

1. Bybit public WebSocket.
2. OKX public WebSocket.
3. Kraken public WebSocket.

BingX deve continuar suportado porque ja existe no codigo, mas o endpoint padrao deve ser o de futuros `wss://open-api-swap.bingx.com/swap-market` quando a estrategia for futuros.

## Motivo

Binance tem liquidez alta, streams publicos, muitos pares e documentacao ampla. Bybit e OKX sao fortes para contratos/perpetuos. Kraken e bom fallback spot regulado para BTC/ETH. Nenhum provider deve ser fonte unica.

## Failover

1. Cada provider publica `price`, `latencyMs`, `updatedAt`, `healthy`, `sequence` e `stale`.
2. O sistema calcula mediana de preco entre providers saudaveis.
3. Se o provider primario divergir mais de 0.5% da mediana, reduzir confianca.
4. Se divergencia passar 1.5% ou data quality cair abaixo de 60, sinal vira `WAIT`.
5. Reconectar com backoff exponencial: 1s, 2s, 5s, 10s, 30s.
6. Reinscrever canais apos reconnect.
7. Persistir erros e latencia por provider.

## Canais Minimos

- Trades recentes.
- Ticker/bookTicker.
- Candles: 1m, 5m, 15m, 1h, 4h, 1d.
- Order book snapshot/delta.
- Mark price, funding e open interest quando provider disponibilizar gratuitamente.

## Estado Atual Do Codigo

- Existe apenas `BingXMarketStream`.
- Worker loga ticks, nao persiste e nao envia para API.
- Existe `ProviderSupervisor` em `packages/exchange` para health, stale detection, data quality e failover deterministico.
- Existe `MarketDataProvider` e `PollingMarketDataSupervisor` para consultar providers REST/simulados de forma uniforme.
- Existe `BinanceTickerProvider` usando `GET /api/v3/ticker/24hr?symbol=...`, endpoint publico oficial de market data spot.
- Existe `BybitTickerProvider` usando `GET /v5/market/tickers?category=spot&symbol=...`, endpoint publico oficial de tickers spot.
- `/providers/status` ja expoe failover/data quality com dados simulados ate o worker alimentar dados reais.
- `apps/worker` grava ticks em `TRADE_STORE_PATH` quando configurado, usando `ProviderSupervisor` para status local do feed.
- O feed simulado do worker ja usa `PollingMarketDataSupervisor`; o WebSocket BingX segue ativo no modo nao simulado.
- `/market/ticker` prefere ticks persistidos na store JSON antes dos ticks demo em memoria.
- `MarketTick.source` ainda e estreito demais para todos os providers planejados.
- Normalizador ignora order book, candles, funding e open interest.

## Proximas Implementacoes

- Implementar providers REST publicos OKX/Kraken usando `MarketDataProvider`.
- Conectar `ProviderSupervisor` ao worker.
- Adicionar `ProviderSetResult` do trading-core como decisor de provider.
- Persistir ticks/candles em Postgres.
