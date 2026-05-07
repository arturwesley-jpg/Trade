import { AaveClient } from './aave.js';
import { CompoundClient } from './compound.js';
import { Web3Client } from '../web3-client.js';
import { LendingProtocol, YieldOpportunity } from '../types/index.js';
import { logger } from '@trade/shared';

export class LendingAggregator {
  private aave: AaveClient;
  private compound: CompoundClient;

  constructor(web3Client: Web3Client) {
    this.aave = new AaveClient(web3Client);
    this.compound = new CompoundClient(web3Client);
  }

  async getAllProtocols(): Promise<LendingProtocol[]> {
    const protocols: LendingProtocol[] = [];

    try {
      // Common assets to check
      const commonAssets = [
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
        '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      ];

      const aaveProtocol = await this.aave.getAllMarkets(commonAssets);
      protocols.push(aaveProtocol);
    } catch (error) {
      logger.warn('Failed to fetch Aave data:', error);
    }

    try {
      const compoundProtocol = await this.compound.getAllMarkets();
      protocols.push(compoundProtocol);
    } catch (error) {
      logger.warn('Failed to fetch Compound data:', error);
    }

    return protocols;
  }

  async getBestSupplyRate(asset: string): Promise<YieldOpportunity | null> {
    try {
      const protocols = await this.getAllProtocols();
      let bestOpportunity: YieldOpportunity | null = null;
      let bestAPY = 0;

      for (const protocol of protocols) {
        const market = protocol.markets.find(m =>
          m.asset.toLowerCase() === asset.toLowerCase()
        );

        if (market && market.supplyAPY > bestAPY) {
          bestAPY = market.supplyAPY;
          bestOpportunity = {
            protocol: protocol.name,
            type: 'lending',
            asset: market.asset,
            apy: market.supplyAPY,
            tvl: market.totalSupply,
            risk: this.assessRisk(protocol.name, market.utilization),
            chainId: protocol.chainId,
          };
        }
      }

      return bestOpportunity;
    } catch (error) {
      logger.error('Error finding best supply rate:', error);
      throw error;
    }
  }

  async getTopOpportunities(minAPY: number = 5): Promise<YieldOpportunity[]> {
    try {
      const protocols = await this.getAllProtocols();
      const opportunities: YieldOpportunity[] = [];

      for (const protocol of protocols) {
        for (const market of protocol.markets) {
          if (market.supplyAPY >= minAPY) {
            opportunities.push({
              protocol: protocol.name,
              type: 'lending',
              asset: market.asset,
              apy: market.supplyAPY,
              tvl: market.totalSupply,
              risk: this.assessRisk(protocol.name, market.utilization),
              chainId: protocol.chainId,
            });
          }
        }
      }

      // Sort by APY descending
      return opportunities.sort((a, b) => b.apy - a.apy);
    } catch (error) {
      logger.error('Error getting top opportunities:', error);
      throw error;
    }
  }

  private assessRisk(protocol: string, utilization: number): 'low' | 'medium' | 'high' {
    // Simplified risk assessment
    if (protocol === 'Aave V3' || protocol === 'Compound V3') {
      if (utilization < 70) return 'low';
      if (utilization < 90) return 'medium';
      return 'high';
    }
    return 'medium';
  }
}

export { AaveClient, CompoundClient };
