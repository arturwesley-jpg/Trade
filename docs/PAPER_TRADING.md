# Paper Trading

## Estado Atual

Existe `PaperExecutor` em `packages/trading-core`, com abertura/fechamento manual de posicoes e PnL simples. Tudo fica em memoria.

## Regras

- Apenas paper nesta fase.
- ADM pode futuramente criar/pausar estrategias ficticias.
- Trade real deve permanecer desabilitado.
- Toda decisao deve salvar snapshot de sinal, mercado e risco.

## Campos Alvo

`strategy_id`, `symbol`, `direction`, `entry_price`, `exit_price`, `stop_loss`, `take_profit`, `size`, `leverage_simulated`, `opened_at`, `closed_at`, `status`, `pnl`, `pnl_percentage`, `fees_estimated`, `slippage_estimated`, `reason_opened`, `reason_closed`, `signal_snapshot`, `market_snapshot`, `risk_snapshot`.

## Metricas

- Win rate.
- Drawdown.
- Profit factor.
- Media ganho/perda.
- Acerto por ativo/timeframe/tipo de sinal/regime/fonte.
- Falso positivo e falso negativo.

## Implementado Agora

- `calculatePaperMetrics` em `packages/trading-core/src/intelligence-engines.ts`.

## Ainda Falta

- Persistencia Postgres.
- Estrategias ADM.
- Stop/take automatico.
- Fees, funding e slippage.
