# Environment Variables

## Seguranca

| Variavel | Obrigatoria | Valor seguro |
|---|---:|---|
| `SAFE_MODE` | Sim | `true` |
| `PAPER_TRADING_ONLY` | Sim | `true` |
| `FEATURE_REAL_TRADING` | Sim | `false` |
| `APP_ENV` | Sim | `development` |
| `LOG_LEVEL` | Nao | `info` |

## API/Web

| Variavel | Uso |
|---|---|
| `API_HOST` | Host Fastify |
| `API_PORT` | Porta da API |
| `WEB_ORIGIN` | CORS permitido |
| `VITE_API_BASE_URL` | URL da API no frontend |
| `API_BASE_URL` | URL da API para bot/worker |

## Banco/Cache

| Variavel | Uso |
|---|---|
| `DATABASE_URL` | Postgres Neon/Supabase/local; quando presente, API e worker usam Postgres |
| `REDIS_URL` | Redis local/Upstash |
| `DATA_DIR` | Reservado para dev local |
| `TRADE_STORE_PATH` | Arquivo JSON local para persistir paper trading/auditoria em desenvolvimento |
| `ADMIN_API_TOKEN` | Token temporario para proteger `/admin/*` ate existir auth com usuario/role |

## Persistencia Local Gratuita

Para nao perder paper trades ao reiniciar em desenvolvimento:

```env
TRADE_STORE_PATH=./data/trade-store.json
```

Essa store JSON e apenas ponte de desenvolvimento. Quando `DATABASE_URL` existe, ela fica em segundo plano e Postgres e usado.

## Providers

As API keys sao opcionais no modo basico. Providers publicos devem rodar sem chave quando possivel.

## Telegram

| Variavel | Uso |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token do BotFather |
| `TELEGRAM_ALLOWED_USER_IDS` | IDs autorizados; obrigatorio em producao |
| `TELEGRAM_ADMIN_IDS` | IDs com permissao para comandos ADM |
| `TELEGRAM_RATE_LIMIT_MAX` | Maximo de comandos por janela |
| `TELEGRAM_RATE_LIMIT_WINDOW_MS` | Janela de rate limit em milissegundos |

Veja `.env.example` para a lista completa.

## Worker

| Variavel | Uso |
|---|---|
| `USE_SIMULATED_MARKET` | Usa feed simulado local quando `true` |
| `MARKET_REST_PROVIDERS` | Lista de providers de polling, ex: `simulated` ou `binance,bybit,simulated` |
| `MARKET_POLL_INTERVAL_MS` | Intervalo do polling para providers sem WebSocket |
| `MAX_MARKET_TICKS` | Quantidade maxima de ticks mantidos na store JSON |
| `PROVIDER_STALE_AFTER_MS` | Janela para marcar provider como stale |
