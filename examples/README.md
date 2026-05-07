# Exemplos de Observabilidade

Este diretório contém exemplos práticos de como usar o sistema de observabilidade do projeto Trade.

## Arquivos

### `observability-example.ts`

Exemplo completo de integração do sistema de observabilidade em uma API Fastify. Demonstra:

- **Structured Logging**: Logs contextualizados por request
- **Metrics Collection**: Métricas de API, database, Redis e trading
- **Health Checks**: Endpoints de liveness, readiness e detailed health
- **Alerting**: Alertas automáticos para eventos críticos
- **Error Handling**: Tratamento de erros com logging e alertas
- **Background Tasks**: Workers com observabilidade
- **Graceful Shutdown**: Shutdown limpo com notificações

## Como Executar

### Pré-requisitos

```bash
# Instalar dependências
npm install

# Compilar o projeto
npm run build

# Configurar variáveis de ambiente
export DATABASE_URL="postgresql://localhost/trade"
export REDIS_URL="redis://localhost:6379"
export LOG_LEVEL="debug"
export NODE_ENV="development"
```

### Executar o Exemplo

```bash
# Com ts-node
npx ts-node examples/observability-example.ts
```

### Testar os Endpoints

```bash
# Health checks
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/detailed

# Métricas Prometheus
curl http://localhost:3000/metrics

# API endpoints
curl http://localhost:3000/api/ping
curl http://localhost:3000/api/positions

# Trading endpoint
curl -X POST http://localhost:3000/api/trade \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","side":"LONG","quantity":0.001}'
```

## Próximos Passos

1. Integrar nos serviços reais (api, worker, telegram-bot)
2. Configurar Prometheus e Grafana em produção
3. Criar dashboards customizados
