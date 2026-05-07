# Telegram Bot

## Estado Atual

O bot usa Telegraf em `apps/telegram-bot/src/bot.ts`. Comandos atuais: `/start`, `/help`, `/status`, `/market`, `/signal`, `/signals`, `/feargreed`, `/news`, `/alerts_on`, `/alerts_off`, `/paper_status`, `/paper_trades`, `/positions` e placeholders ADM.

## Problemas Encontrados

- O bot desempacota respostas `{ data }`.
- `TELEGRAM_ALLOWED_USER_IDS` e obrigatorio em producao.
- `TELEGRAM_ADMIN_IDS` separa roles ADM para comandos administrativos.
- Ha rate limit local por usuario.
- Nao ha alertas push.
- Nao ha logs de interacoes no banco.

## Comandos Alvo

- `/start`
- `/help`
- `/status`
- `/market BTCUSDT`
- `/signal BTCUSDT`
- `/feargreed`
- `/news`
- `/alerts_on`
- `/alerts_off`
- `/paper_status`
- `/paper_trades`
- `/admin_status`
- `/admin_strategy_create`
- `/admin_strategy_pause`
- `/admin_strategy_resume`

## Seguranca

- `TELEGRAM_ALLOWED_USER_IDS` deve ser obrigatorio em producao.
- `TELEGRAM_ADMIN_IDS` separa admins.
- Rate limit local por usuario via `TELEGRAM_RATE_LIMIT_MAX` e `TELEGRAM_RATE_LIMIT_WINDOW_MS`; Redis deve substituir isso em producao distribuida.
- Todos comandos admin devem gerar auditoria quando a persistencia duravel estiver conectada.
- Comandos de trade real nao existem nesta fase.

## Como Testar

1. Criar bot com BotFather.
2. Configurar `TELEGRAM_BOT_TOKEN`.
3. Colocar seu ID em `TELEGRAM_ALLOWED_USER_IDS`.
4. Rodar API: `npm run dev:api`.
5. Rodar bot: `npm run dev:telegram`.
6. Enviar `/status`.
