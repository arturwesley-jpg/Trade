# News Sentiment

## Objetivo

Ler noticias de crypto, classificar impacto e cruzar com preco, volume e on-chain.

## Fontes Iniciais

- CoinDesk RSS oficial: `https://www.coindesk.com/arc/outboundfeeds/rss/`.
- Cointelegraph RSS: pagina RSS oficial por categorias.
- Decrypt RSS: precisa confirmar URL oficial antes de producao.
- CryptoSlate: precisa confirmar RSS/API e termos.
- Bitcoin Magazine: precisa confirmar RSS/API e termos.

## Classificacao

- Ativo citado.
- Setor.
- Impacto.
- Urgencia.
- Polaridade.
- Confiabilidade da fonte.
- Duplicidade.

## Eventos

Hack, exploit, ETF, regulacao, processo judicial, falencia, listing, delisting, parceria, unlock, outage.

## Implementado Agora

- `scoreNewsSentiment` em `packages/trading-core/src/intelligence-engines.ts` com baseline por palavras-chave.

## Ainda Falta

- Worker RSS real.
- Deduplicacao por URL/hash.
- Persistencia em `news_items` e `news_sentiment`.
