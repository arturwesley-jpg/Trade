# On-chain Monitoring

## Objetivo

Monitorar carteiras, exchanges, stablecoins, bridges e baleias para compor score de risco/pressao.

## Fontes Gratuitas

- Etherscan V2: free 3 calls/s e 100k/dia em chains selecionadas.
- BscScan: free community endpoints, 5 calls/s com key.
- PolygonScan: free community endpoints, 5 calls/s e 100k/dia citado em docs/info.
- DeFiLlama: TVL, stablecoins e protocolos via API publica.

## Evento Alvo

`chain`, `address_from`, `address_to`, `asset`, `amount`, `value_usd`, `transaction_hash`, `timestamp`, `classification`, `likely_entity`, `confidence`, `source_provider`, `market_impact_score`.

## Scores

- `whale_score`: -100 a 100.
- `exchange_flow_score`: -100 a 100.
- `stablecoin_flow_score`: -100 a 100.
- `onchain_bias`: bullish, neutral ou bearish.

## Implementado Agora

- `scoreOnchainEvents` em `packages/trading-core/src/intelligence-engines.ts`.

## Ainda Falta

- Ingestao real via APIs.
- Lista curada de enderecos.
- Persistencia e deduplicacao por hash.
