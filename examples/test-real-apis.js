#!/usr/bin/env node

/**
 * Exemplo de uso das APIs reais integradas
 *
 * Este script demonstra como usar os novos endpoints que consomem dados reais
 * de CoinGecko, RSS feeds e DeFiLlama.
 */

const API_BASE_URL = process.env.API_URL || "http://localhost:4000";

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function main() {
  console.log("=== Testando APIs Reais ===\n");

  // 1. Buscar notícias reais
  console.log("1. Buscando notícias de RSS feeds...");
  try {
    const newsResponse = await fetchJson(`${API_BASE_URL}/news`);
    const news = newsResponse.data;

    console.log(`   Fonte: ${news.source}`);
    console.log(`   Total de notícias: ${news.items.length}`);
    console.log(`   Sentimento: ${news.sentiment.label} (score: ${news.sentiment.score})`);

    if (news.warning) {
      console.log(`   ⚠️  Warning: ${news.warning}`);
    }

    if (news.items.length > 0) {
      console.log(`   Última notícia: "${news.items[0].title}"`);
      console.log(`   Fonte: ${news.items[0].source}`);
    }
  } catch (error) {
    console.error(`   ❌ Erro: ${error.message}`);
  }

  console.log();

  // 2. Buscar Fear & Greed Index aprimorado
  console.log("2. Buscando Fear & Greed Index...");
  try {
    const fgResponse = await fetchJson(`${API_BASE_URL}/sentiment/fear-greed`);
    const fg = fgResponse.data;

    console.log(`   Score: ${fg.score}`);
    console.log(`   Label: ${fg.label}`);
    console.log(`   Fonte: ${fg.source}`);

    if (fg.warning) {
      console.log(`   ⚠️  Warning: ${fg.warning}`);
    }
  } catch (error) {
    console.error(`   ❌ Erro: ${error.message}`);
  }

  console.log();

  // 3. Buscar fundamentals do Bitcoin
  console.log("3. Buscando fundamentals do BTC...");
  try {
    const btcResponse = await fetchJson(`${API_BASE_URL}/fundamentals/BTC-USDT`);
    const btc = btcResponse.data;

    console.log(`   Símbolo: ${btc.symbol}`);
    console.log(`   Preço: $${btc.priceUsd.toLocaleString()}`);
    console.log(`   Market Cap: $${(btc.marketCapUsd / 1e9).toFixed(2)}B`);
    console.log(`   Volume 24h: $${(btc.volume24hUsd / 1e9).toFixed(2)}B`);
    console.log(`   Variação 24h: ${btc.priceChange24hPct.toFixed(2)}%`);
    console.log(`   Fonte: ${btc.source}`);

    if (btc.warning) {
      console.log(`   ⚠️  Warning: ${btc.warning}`);
    }
  } catch (error) {
    console.error(`   ❌ Erro: ${error.message}`);
  }

  console.log();

  // 4. Buscar fundamentals do Ethereum
  console.log("4. Buscando fundamentals do ETH...");
  try {
    const ethResponse = await fetchJson(`${API_BASE_URL}/fundamentals/ETH-USDT`);
    const eth = ethResponse.data;

    console.log(`   Símbolo: ${eth.symbol}`);
    console.log(`   Preço: $${eth.priceUsd.toLocaleString()}`);
    console.log(`   Market Cap: $${(eth.marketCapUsd / 1e9).toFixed(2)}B`);
    console.log(`   Volume 24h: $${(eth.volume24hUsd / 1e9).toFixed(2)}B`);
    console.log(`   Variação 24h: ${eth.priceChange24hPct.toFixed(2)}%`);
    console.log(`   Fonte: ${eth.source}`);

    if (eth.warning) {
      console.log(`   ⚠️  Warning: ${eth.warning}`);
    }
  } catch (error) {
    console.error(`   ❌ Erro: ${error.message}`);
  }

  console.log();

  // 5. Buscar dados on-chain do Ethereum
  console.log("5. Buscando dados on-chain do ETH...");
  try {
    const onchainResponse = await fetchJson(`${API_BASE_URL}/onchain/ETH-USDT`);
    const onchain = onchainResponse.data;

    console.log(`   Símbolo: ${onchain.symbol}`);
    console.log(`   TVL: $${(onchain.tvlUsd / 1e9).toFixed(2)}B`);

    if (onchain.change1d !== null) {
      console.log(`   Variação 1d: ${onchain.change1d.toFixed(2)}%`);
    }

    if (onchain.change7d !== null) {
      console.log(`   Variação 7d: ${onchain.change7d.toFixed(2)}%`);
    }

    console.log(`   Fonte: ${onchain.source}`);

    if (onchain.warning) {
      console.log(`   ⚠️  Warning: ${onchain.warning}`);
    }
  } catch (error) {
    console.error(`   ❌ Erro: ${error.message}`);
  }

  console.log();
  console.log("=== Teste Concluído ===");
}

main().catch(console.error);
