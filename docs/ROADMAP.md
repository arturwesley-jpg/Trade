# Roadmap

## Fase 1: Auditoria

Concluido nesta entrega: auditoria multiagente, matriz de servicos, arquitetura e motores puros iniciais.

## Fase 2: Persistencia

- Adicionar Postgres.
- Criar migrations.
- Persistir ticks, candles, signals, alerts, paper trades e audit logs.

## Fase 3: Market Data

- Interface `MarketDataProvider`.
- Binance, Bybit, OKX, Kraken e BingX.
- Reconnect/backoff/failover.
- Data quality score.

## Fase 4: API

- Modularizar rotas.
- Adicionar auth e roles.
- Criar endpoints alvo.

## Fase 5: Telegram

- Corrigir wrapper.
- Completar comandos.
- Rate limit e auditoria.

## Fase 6: Frontend/Admin

- Painel admin.
- Provider status.
- Paper metrics.
- Alert ack/rules.

## Fase 7: Backtesting

- Historico de candles.
- Backtest por estrategia/timeframe/regime.
- Ajuste de pesos com protecao contra overfitting.
