# Setup Free Services

## Banco: Neon

1. Acesse `https://neon.com`.
2. Crie conta gratuita.
3. Crie um projeto Postgres.
4. Copie a connection string pooled.
5. Configure `DATABASE_URL`.

## Redis: Upstash

1. Acesse `https://upstash.com`.
2. Crie Redis free.
3. Copie URL/token REST ou Redis URL.
4. Configure `REDIS_URL`.

## Market Data

Para modo basico, nao precisa API key. Configure:

```env
MARKET_PROVIDER_PRIMARY=binance
MARKET_PROVIDER_FALLBACK_1=bybit
MARKET_PROVIDER_FALLBACK_2=okx
MARKET_PROVIDER_FALLBACK_3=kraken
```

## CoinGecko

1. Acesse `https://www.coingecko.com/en/api`.
2. Crie conta Demo.
3. Copie API key.
4. Configure `COINGECKO_API_KEY`.

## Etherscan

1. Acesse `https://etherscan.io`.
2. Crie conta.
3. Abra API Dashboard e crie key.
4. Configure `ETHERSCAN_API_KEY`.

## Telegram

1. Abra BotFather no Telegram.
2. Crie bot e copie token.
3. Configure `TELEGRAM_BOT_TOKEN`.
4. Descubra seu Telegram ID.
5. Configure `TELEGRAM_ALLOWED_USER_IDS` e `TELEGRAM_ADMIN_IDS`.

## Observabilidade

UptimeRobot free pode monitorar `/health` a cada 5 minutos.
