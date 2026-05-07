# Integração de APIs Reais

Este documento descreve como o sistema integra APIs reais para dados de mercado, notícias e on-chain.

## Providers Implementados

### 1. CoinGecko Provider (`coingecko-provider.ts`)

Busca dados fundamentais de criptomoedas da API do CoinGecko.

**Dados retornados:**
- Market cap (USD)
- Volume 24h (USD)
- Preço atual (USD)
- Variação de preço 24h (%)
- Circulating supply
- Total supply
- Max supply

**Configuração:**
```bash
# Opcional - aumenta rate limits
COINGECKO_API_KEY=your_api_key_here
```

**Rate Limits (Free Tier):**
- 10-50 chamadas/minuto
- Cache de 5 minutos implementado

### 2. RSS News Provider (`rss-news-provider.ts`)

Busca notícias de feeds RSS de fontes confiáveis.

**Fontes configuradas:**
- CoinTelegraph: `https://cointelegraph.com/rss`
- CoinDesk: `https://www.coindesk.com/arc/outboundfeeds/rss/`

**Dados retornados:**
- Título
- Link
- Data de publicação
- Fonte
- Descrição (quando disponível)

**Configuração:**
Não requer API key. Funciona out-of-the-box.

**Rate Limits:**
- Timeout de 15 segundos por feed
- Máximo 10 itens por feed
- Cache de 5 minutos

### 3. DeFiLlama Provider (`defillama-provider.ts`)

Busca dados on-chain de protocolos DeFi.

**Dados retornados:**
- TVL (Total Value Locked) em USD
- TVL por blockchain
- Variação 1h, 1d, 7d
- Market cap (quando disponível)

**Configuração:**
Não requer API key. API pública e gratuita.

**Rate Limits:**
- Sem limite oficial documentado
- Cache de 5 minutos implementado

## Data Aggregator

O `DataAggregator` (`apps/api/src/data-aggregator.ts`) centraliza o acesso a todos os providers e implementa:

### Funcionalidades

1. **Cache automático**: 5 minutos para cada tipo de dado
2. **Fallback para dados simulados**: Se a API falhar, retorna dados simulados com warning
3. **Gestão de erros**: Captura e reporta erros sem quebrar o sistema

### Métodos

```typescript
// Buscar fundamentals de um símbolo
await dataAggregator.fetchFundamentals("BTC-USDT");

// Buscar notícias
await dataAggregator.fetchNews();

// Buscar dados on-chain
await dataAggregator.fetchOnchainData("ETH-USDT");

// Limpar cache manualmente
dataAggregator.clearCache();
```

## Endpoints da API

### GET /news

Retorna notícias de criptomoedas com análise de sentimento.

**Resposta:**
```json
{
  "source": "rss",
  "items": [
    {
      "title": "Bitcoin ETF inflows reach new highs",
      "source": "CoinDesk",
      "publishedAt": "2026-05-02T22:00:00.000Z",
      "link": "https://...",
      "description": "..."
    }
  ],
  "sentiment": {
    "score": 65,
    "label": "bullish"
  },
  "warning": "Optional warning message if fallback was used"
}
```

### GET /sentiment/fear-greed

Retorna índice Fear & Greed aprimorado com dados reais.

**Resposta:**
```json
{
  "score": 72,
  "label": "greed",
  "updatedAt": "2026-05-02T22:00:00.000Z",
  "source": "external",
  "warning": "Optional warning message"
}
```

### GET /fundamentals/:symbol

Retorna dados fundamentais de um símbolo.

**Exemplo:** `GET /fundamentals/BTC-USDT`

**Resposta:**
```json
{
  "symbol": "BTC",
  "marketCapUsd": 1900000000000,
  "volume24hUsd": 45000000000,
  "priceUsd": 100000,
  "priceChange24hPct": 2.5,
  "source": "coingecko",
  "lastUpdated": "2026-05-02T22:00:00.000Z",
  "warning": "Optional warning message"
}
```

### GET /onchain/:symbol

Retorna dados on-chain de um símbolo.

**Exemplo:** `GET /onchain/ETH-USDT`

**Resposta:**
```json
{
  "symbol": "ETH",
  "tvlUsd": 50000000000,
  "change1d": 2.1,
  "change7d": 8.5,
  "source": "defillama",
  "lastUpdated": "2026-05-02T22:00:00.000Z",
  "warning": "Optional warning message"
}
```

## Modo de Operação

### Com APIs Configuradas

O sistema usa dados reais das APIs e retorna `source: "external"` ou `source: "rss"` ou `source: "coingecko"`.

### Sem APIs (Modo Simulado)

Se as APIs falharem ou não estiverem disponíveis:
1. Sistema retorna dados simulados automaticamente
2. Campo `source` indica `"simulated"`
3. Campo `warning` explica o motivo do fallback
4. Sistema continua funcionando normalmente

## Configuração de Ambiente

Adicione ao seu `.env`:

```bash
# Opcional - melhora rate limits do CoinGecko
COINGECKO_API_KEY=your_coingecko_api_key

# Outras APIs não requerem keys (free tier)
```

## Mapeamento de Símbolos

Os providers fazem mapeamento automático de símbolos:

```typescript
// CoinGecko
BTC-USDT -> bitcoin
ETH-USDT -> ethereum
BNB-USDT -> binancecoin

// DeFiLlama
BTC-USDT -> bitcoin
ETH-USDT -> ethereum
AVAX-USDT -> avalanche
```

## Tratamento de Erros

Todos os providers implementam:
- Timeout configurável (padrão: 10-15 segundos)
- Retry automático via cache
- Fallback para dados simulados
- Logging de erros com contexto

## Próximos Passos

Para adicionar mais providers:

1. Criar novo provider em `packages/trading-core/src/data-providers/`
2. Exportar no `index.ts` do trading-core
3. Adicionar ao `DataAggregator`
4. Criar endpoints na API se necessário
5. Atualizar esta documentação

## Limitações Conhecidas

1. **Whale Events**: Ainda usa dados simulados (requer API paga como Whale Alert)
2. **Rate Limits**: Free tiers têm limites - cache de 5 minutos ajuda
3. **Símbolos**: Nem todos os símbolos têm mapeamento - fallback para lowercase
