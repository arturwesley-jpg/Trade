# Prometheus Queries - Trade Bot

Queries úteis para monitoramento do sistema de trading.

## API Performance

### Request Rate
```promql
# Requests por segundo
rate(api_requests_total[5m])

# Por endpoint
sum(rate(api_requests_total[5m])) by (path)

# Por método
sum(rate(api_requests_total[5m])) by (method)
```

### Error Rate
```promql
# Taxa de erro geral
rate(api_errors_total[5m]) / rate(api_requests_total[5m])

# Taxa de erro por endpoint
sum(rate(api_errors_total[5m])) by (path) / sum(rate(api_requests_total[5m])) by (path)

# Erros 5xx
sum(rate(api_requests_total{status=~"5.."}[5m]))
```

### Latency
```promql
# P50 latency
histogram_quantile(0.50, rate(api_request_duration_ms_bucket[5m]))

# P95 latency
histogram_quantile(0.95, rate(api_request_duration_ms_bucket[5m]))

# P99 latency
histogram_quantile(0.99, rate(api_request_duration_ms_bucket[5m]))

# Latency por endpoint
histogram_quantile(0.95, sum(rate(api_request_duration_ms_bucket[5m])) by (path, le))
```

## Trading Metrics

### Positions
```promql
# Posições ativas
trading_active_positions

# Posições ativas por símbolo
sum(trading_active_positions) by (symbol)

# Posições abertas (rate)
rate(trading_positions_opened_total[1h])

# Posições fechadas (rate)
rate(trading_positions_closed_total[1h])
```

### P&L
```promql
# P&L atual (24h)
trading_pnl_usd{period="24h"}

# Win rate
trading_win_rate{period="24h"}
```

### Orders
```promql
# Ordens executadas por hora
rate(trading_orders_executed_total[1h]) * 3600

# Taxa de falha de ordens
rate(trading_orders_failed_total[5m]) / (rate(trading_orders_executed_total[5m]) + rate(trading_orders_failed_total[5m]))

# Ordens falhadas por razão
sum(rate(trading_orders_failed_total[5m])) by (reason)
```

## Worker Performance

### Ticks
```promql
# Ticks processados por segundo
rate(worker_ticks_processed_total[5m])

# Duração média do tick
rate(worker_tick_duration_ms_sum[5m]) / rate(worker_tick_duration_ms_count[5m])

# P95 duração do tick
histogram_quantile(0.95, rate(worker_tick_duration_ms_bucket[5m]))
```

### Signals
```promql
# Sinais gerados por minuto
rate(worker_signals_generated_total[1m]) * 60

# Sinais por tipo
sum(rate(worker_signals_generated_total[5m])) by (signal_type)

# Sinais por símbolo
sum(rate(worker_signals_generated_total[5m])) by (symbol)
```

## Database Performance

### Query Performance
```promql
# Queries por segundo
rate(db_queries_total[5m])

# Duração média das queries
rate(db_query_duration_ms_sum[5m]) / rate(db_query_duration_ms_count[5m])

# P95 duração das queries
histogram_quantile(0.95, rate(db_query_duration_ms_bucket[5m]))

# Queries lentas (> 100ms)
sum(rate(db_query_duration_ms_bucket{le="100"}[5m])) / sum(rate(db_query_duration_ms_count[5m]))
```

### Query Errors
```promql
# Taxa de erro de queries
rate(db_query_errors_total[5m]) / rate(db_queries_total[5m])

# Erros por tabela
sum(rate(db_query_errors_total[5m])) by (table)

# Erros por tipo
sum(rate(db_query_errors_total[5m])) by (error_type)
```

### Connections
```promql
# Conexões ativas
db_connections_active
```

## Redis Performance

### Commands
```promql
# Comandos por segundo
rate(redis_commands_total[5m])

# Duração média dos comandos
rate(redis_command_duration_ms_sum[5m]) / rate(redis_command_duration_ms_count[5m])

# P95 duração dos comandos
histogram_quantile(0.95, rate(redis_command_duration_ms_bucket[5m]))

# Comandos por tipo
sum(rate(redis_commands_total[5m])) by (command)
```

### Errors
```promql
# Taxa de erro
rate(redis_command_errors_total[5m]) / rate(redis_commands_total[5m])

# Erros por comando
sum(rate(redis_command_errors_total[5m])) by (command)
```

## WebSocket

### Connections
```promql
# Conexões ativas
websocket_connections

# Conexões por exchange
sum(websocket_connections) by (exchange)
```

### Messages
```promql
# Mensagens por segundo
rate(websocket_messages_total[5m])

# Mensagens por tipo
sum(rate(websocket_messages_total[5m])) by (type)

# Mensagens por exchange
sum(rate(websocket_messages_total[5m])) by (exchange)
```

### Errors & Reconnects
```promql
# Erros por minuto
rate(websocket_errors_total[1m]) * 60

# Reconexões por hora
rate(websocket_reconnects_total[1h]) * 3600

# Erros por tipo
sum(rate(websocket_errors_total[5m])) by (error_type)
```

## System Metrics

### CPU
```promql
# CPU usage
rate(process_cpu_seconds_total[5m]) * 100

# CPU user time
rate(process_cpu_user_seconds_total[5m])

# CPU system time
rate(process_cpu_system_seconds_total[5m])
```

### Memory
```promql
# Heap usado (MB)
nodejs_heap_size_used_bytes / 1024 / 1024

# Heap total (MB)
nodejs_heap_size_total_bytes / 1024 / 1024

# RSS (MB)
process_resident_memory_bytes / 1024 / 1024

# Uso de heap (%)
(nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes) * 100
```

### Event Loop
```promql
# Event loop lag
nodejs_eventloop_lag_ms

# Event loop lag > 100ms
nodejs_eventloop_lag_ms > 100

# Event loop lag médio
avg_over_time(nodejs_eventloop_lag_ms[5m])
```

### Garbage Collection
```promql
# GC duration
rate(nodejs_gc_duration_seconds_sum[5m])

# GC por tipo
sum(rate(nodejs_gc_duration_seconds_count[5m])) by (kind)
```

## Alerting Rules

### Critical Alerts
```promql
# API down
up{job="trade-api"} == 0

# High error rate (> 5%)
rate(api_errors_total[5m]) / rate(api_requests_total[5m]) > 0.05

# High latency (P95 > 1s)
histogram_quantile(0.95, rate(api_request_duration_ms_bucket[5m])) > 1000

# Event loop lag (> 1s)
nodejs_eventloop_lag_ms > 1000

# Memory usage (> 90%)
(nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes) * 100 > 90

# Database errors
rate(db_query_errors_total[5m]) > 0.1

# Redis errors
rate(redis_command_errors_total[5m]) > 0.1

# WebSocket disconnected
websocket_connections{exchange="BingX"} == 0
```

### Warning Alerts
```promql
# High latency (P95 > 500ms)
histogram_quantile(0.95, rate(api_request_duration_ms_bucket[5m])) > 500

# Event loop lag (> 500ms)
nodejs_eventloop_lag_ms > 500

# Memory usage (> 80%)
(nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes) * 100 > 80

# Slow database queries (P95 > 100ms)
histogram_quantile(0.95, rate(db_query_duration_ms_bucket[5m])) > 100

# High order failure rate (> 10%)
rate(trading_orders_failed_total[5m]) / (rate(trading_orders_executed_total[5m]) + rate(trading_orders_failed_total[5m])) > 0.1
```

## Dashboard Panels

### Overview Panel
```promql
# Uptime
(time() - process_start_time_seconds) / 3600

# Total requests (24h)
increase(api_requests_total[24h])

# Active positions
sum(trading_active_positions)

# P&L (24h)
trading_pnl_usd{period="24h"}
```

### Performance Panel
```promql
# Request rate
rate(api_requests_total[5m])

# Error rate
rate(api_errors_total[5m]) / rate(api_requests_total[5m])

# P95 latency
histogram_quantile(0.95, rate(api_request_duration_ms_bucket[5m]))

# Event loop lag
nodejs_eventloop_lag_ms
```

### Trading Panel
```promql
# Positions opened (1h)
increase(trading_positions_opened_total[1h])

# Positions closed (1h)
increase(trading_positions_closed_total[1h])

# Win rate
trading_win_rate{period="24h"}

# Active positions
trading_active_positions
```

## Recording Rules

Para otimizar queries frequentes:

```yaml
groups:
  - name: trade_recording_rules
    interval: 30s
    rules:
      # API
      - record: job:api_request_rate:5m
        expr: rate(api_requests_total[5m])
      
      - record: job:api_error_rate:5m
        expr: rate(api_errors_total[5m]) / rate(api_requests_total[5m])
      
      - record: job:api_latency_p95:5m
        expr: histogram_quantile(0.95, rate(api_request_duration_ms_bucket[5m]))
      
      # Trading
      - record: job:trading_positions_rate:1h
        expr: rate(trading_positions_opened_total[1h])
      
      - record: job:trading_order_failure_rate:5m
        expr: rate(trading_orders_failed_total[5m]) / (rate(trading_orders_executed_total[5m]) + rate(trading_orders_failed_total[5m]))
      
      # System
      - record: job:memory_usage_percent
        expr: (nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes) * 100
```
