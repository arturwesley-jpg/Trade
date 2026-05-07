# Operations

## Rodar Localmente

```bash
npm install
npm run dev:api
npm run dev:web
npm run dev:worker
```

Com persistencia local de paper trading:

```bash
TRADE_STORE_PATH=./data/trade-store.json ADMIN_API_TOKEN=troque-este-token npm run dev:api
```

Com Postgres/Neon:

```bash
DATABASE_URL=postgresql://... npm run db:migrate -w apps/api
DATABASE_URL=postgresql://... ADMIN_API_TOKEN=troque-este-token npm run dev:api
DATABASE_URL=postgresql://... USE_SIMULATED_MARKET=true npm run dev:worker
```

Worker gravando ticks na mesma store:

```bash
TRADE_STORE_PATH=./data/trade-store.json USE_SIMULATED_MARKET=true npm run dev:worker
```

Bot:

```bash
npm run dev:telegram
```

## Docker Dev

```bash
docker compose -f infra/docker-compose.yml up
```

## Verificacao

```bash
npm test
npm run typecheck
npm run build
```

## Deploy Atual

- Frontend: Vercel.
- API: Render configurado fora do repo, mas builds falharam anteriormente.

## Health Checks

- API: `GET /health`.
- Admin audit: `GET /admin/audit-logs` com header `x-admin-token`.
- Paper summary: `GET /paper/summary`.
- Market ticker: `GET /market/ticker` usa ticks persistidos quando `TRADE_STORE_PATH` tem dados.
- UptimeRobot free pode monitorar a cada 5 minutos.

## Runbook Basico

1. Se API nao responde, checar logs Render.
2. Se frontend nao carrega dados, verificar `VITE_API_BASE_URL`.
3. Se bot responde errado, verificar API wrapper `{ data }`.
4. Se sinais parecem estranhos, verificar se dados sao simulados.
5. Se paper trades somem ao reiniciar, verificar `DATABASE_URL` ou `TRADE_STORE_PATH`.
6. Se ticks nao aparecem na API, rodar API e worker com o mesmo `DATABASE_URL` ou `TRADE_STORE_PATH`.
