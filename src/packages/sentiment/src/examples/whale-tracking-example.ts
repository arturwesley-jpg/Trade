/**
 * Whale Tracking System - Example Usage
 *
 * Demonstrates how to use the whale tracking system to monitor
 * large cryptocurrency transactions and analyze whale behavior.
 */

import { WhaleTracker, WhaleEventProcessor } from '@trade/sentiment';
import { PostgresWhaleEventRepository, createDatabaseClient } from '@trade/database';
import { logger } from '@trade/shared';

async function main() {
  // Initialize whale tracker
  const whaleTracker = new WhaleTracker({
    minTransactionUSD: 100000, // Track transactions > $100k
    significanceThresholds: {
      low: 100000,
      medium: 500000,
      high: 1000000,
      critical: 5000000,
    },
    whaleAlertApiKey: process.env.WHALE_ALERT_API_KEY,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY,
    bscscanApiKey: process.env.BSCSCAN_API_KEY,
    enableCaching: true,
    cacheTTL: 300, // 5 minutes
  });

  // Example 1: Fetch recent whale transactions for Bitcoin
  console.log('\n=== Example 1: Recent BTC Whale Transactions ===');
  const btcActivities = await whaleTracker.fetchWhaleAlertTransactions('BTC', undefined, 10);
  console.log(`Found ${btcActivities.length} recent BTC whale transactions`);

  for (const activity of btcActivities.slice(0, 3)) {
    console.log(`- ${activity.type}: $${activity.amountUSD.toLocaleString()} (${activity.significance})`);
    console.log(`  From: ${activity.fromAddress?.slice(0, 10)}...`);
    console.log(`  To: ${activity.toAddress?.slice(0, 10)}...`);
    console.log(`  Time: ${activity.timestamp.toISOString()}`);
  }

  // Example 2: Analyze whale activity
  console.log('\n=== Example 2: Whale Activity Analysis ===');
  const analysis = whaleTracker.analyzeActivity(btcActivities);
  console.log(`Score: ${analysis.score.toFixed(2)} (${analysis.significance})`);
  console.log(`Summary: ${analysis.summary}`);

  // Example 3: Exchange flow analysis
  console.log('\n=== Example 3: Exchange Flow Analysis ===');
  const exchangeFlow = await whaleTracker.getExchangeFlowAnalysis('ETH', 24);
  console.log(`Total Inflow: $${exchangeFlow.totalInflow.toLocaleString()}`);
  console.log(`Total Outflow: $${exchangeFlow.totalOutflow.toLocaleString()}`);
  console.log(`Net Flow: $${exchangeFlow.netFlow.toLocaleString()}`);
  console.log(`Sentiment: ${exchangeFlow.sentiment}`);

  // Example 4: Stablecoin flows
  console.log('\n=== Example 4: Stablecoin Flows ===');
  const stablecoinFlows = await whaleTracker.getStablecoinFlows(24);
  console.log(`Total Inflow: $${stablecoinFlows.totalInflow.toLocaleString()}`);
  console.log(`Total Outflow: $${stablecoinFlows.totalOutflow.toLocaleString()}`);
  console.log(`Net Flow: $${stablecoinFlows.netFlow.toLocaleString()}`);
  console.log(`Sentiment: ${stablecoinFlows.sentiment}`);

  // Example 5: Wallet classification
  console.log('\n=== Example 5: Wallet Classification ===');
  const exampleWallet = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
  const walletInfo = await whaleTracker.classifyWallet(exampleWallet);
  console.log(`Address: ${walletInfo.address}`);
  console.log(`Type: ${walletInfo.type}`);
  console.log(`Label: ${walletInfo.label || 'N/A'}`);
  console.log(`Transaction Count: ${walletInfo.transactionCount || 0}`);

  // Example 6: Detect accumulation pattern
  console.log('\n=== Example 6: Accumulation Pattern Detection ===');
  const accumulationPattern = await whaleTracker.detectAccumulationPattern(
    exampleWallet,
    'ETH',
    24
  );

  if (accumulationPattern) {
    console.log(`Symbol: ${accumulationPattern.symbol}`);
    console.log(`Buy Count: ${accumulationPattern.buyCount}`);
    console.log(`Total USD: $${accumulationPattern.totalUSD.toLocaleString()}`);
    console.log(`Average Size: $${accumulationPattern.averageSize.toLocaleString()}`);
    console.log(`Confidence: ${accumulationPattern.confidence}%`);
  } else {
    console.log('No accumulation pattern detected');
  }

  // Example 7: Database integration with event processor
  console.log('\n=== Example 7: Event Processor (Database Integration) ===');

  const db = await createDatabaseClient({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'trading_bot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  const repository = new PostgresWhaleEventRepository(db);

  const eventProcessor = new WhaleEventProcessor({
    whaleTracker,
    repository,
    processingInterval: 60000, // 1 minute
    symbols: ['BTC', 'ETH', 'BNB'],
  });

  // Start processing (in production, this would run continuously)
  console.log('Starting event processor...');
  eventProcessor.start();

  // Wait a bit to process some events
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Get activity summary
  const summary = await eventProcessor.getActivitySummary('BTC', 24);
  console.log('\nBTC Activity Summary (24h):');
  console.log(`Total Events: ${summary.totalEvents}`);
  console.log(`Total Volume: $${summary.totalVolume.toLocaleString()}`);
  console.log(`Largest Transaction: $${summary.largestTransaction.toLocaleString()}`);
  console.log(`Exchange Inflows: $${summary.exchangeInflows.toLocaleString()}`);
  console.log(`Exchange Outflows: $${summary.exchangeOutflows.toLocaleString()}`);
  console.log(`Net Flow: $${summary.netFlow.toLocaleString()}`);
  console.log(`Sentiment: ${summary.sentiment}`);

  // Analyze correlation
  const correlation = await eventProcessor.analyzeCorrelation('BTC', 24);
  console.log('\nCorrelation Analysis:');
  console.log(`Correlation: ${correlation.correlation.toFixed(2)}`);
  console.log(`Confidence: ${correlation.confidence}%`);
  console.log(`Summary: ${correlation.summary}`);

  // Stop processor
  eventProcessor.stop();
  await db.close();

  console.log('\n=== Whale Tracking Demo Complete ===');
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('Demo completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Demo failed', { error });
      process.exit(1);
    });
}

export { main };
