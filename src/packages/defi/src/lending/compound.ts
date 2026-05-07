import { ethers } from 'ethers';
import { Web3Client } from '../web3-client.js';
import { LendingMarket, LendingProtocol } from '../types/index.js';
import { logger } from '@trade/shared';

// Compound V3 Comet address on Ethereum mainnet (USDC market)
const COMPOUND_V3_USDC = '0xc3d688B66703497DAA19211EEdff47f25384cdc3';

export class CompoundClient {
  private web3Client: Web3Client;
  private cometContract: ethers.Contract;

  constructor(web3Client: Web3Client) {
    this.web3Client = web3Client;

    const cometABI = [
      'function getSupplyRate(uint utilization) public view returns (uint64)',
      'function getBorrowRate(uint utilization) public view returns (uint64)',
      'function totalSupply() external view returns (uint256)',
      'function totalBorrow() external view returns (uint256)',
      'function getUtilization() public view returns (uint)',
      'function getAssetInfo(uint8 i) public view returns (tuple(uint8 offset, address asset, address priceFeed, uint64 scale, uint64 borrowCollateralFactor, uint64 liquidateCollateralFactor, uint64 liquidationFactor, uint128 supplyCap))',
      'function numAssets() external view returns (uint8)',
      'function baseToken() external view returns (address)',
    ];

    this.cometContract = new ethers.Contract(
      COMPOUND_V3_USDC,
      cometABI,
      this.web3Client.getProvider()
    );
  }

  async getMarketData(assetAddress?: string): Promise<LendingMarket> {
    try {
      const [totalSupply, totalBorrow, utilization, baseToken] = await Promise.all([
        this.cometContract.totalSupply(),
        this.cometContract.totalBorrow(),
        this.cometContract.getUtilization(),
        this.cometContract.baseToken(),
      ]);

      const utilizationRate = Number(utilization) / 1e18;

      // Get supply and borrow rates
      const supplyRate = await this.cometContract.getSupplyRate(utilization);
      const borrowRate = await this.cometContract.getBorrowRate(utilization);

      // Convert rates to APY (rates are per second in Compound V3)
      const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;
      const supplyAPY = (Number(supplyRate) / 1e18) * SECONDS_PER_YEAR * 100;
      const borrowAPY = (Number(borrowRate) / 1e18) * SECONDS_PER_YEAR * 100;

      return {
        asset: assetAddress || baseToken,
        supplyAPY,
        borrowAPY,
        totalSupply: Number(ethers.formatUnits(totalSupply, 6)), // USDC has 6 decimals
        totalBorrow: Number(ethers.formatUnits(totalBorrow, 6)),
        utilization: utilizationRate * 100,
        collateralFactor: 0.8, // Simplified, varies by asset
      };
    } catch (error) {
      logger.error('Error fetching Compound market data:', error);
      throw error;
    }
  }

  async getAllMarkets(): Promise<LendingProtocol> {
    try {
      const numAssets = await this.cometContract.numAssets();
      const markets: LendingMarket[] = [];

      // Get base market (USDC)
      const baseMarket = await this.getMarketData();
      markets.push(baseMarket);

      // Get collateral assets
      for (let i = 0; i < numAssets; i++) {
        try {
          const assetInfo = await this.cometContract.getAssetInfo(i);
          const collateralFactor = Number(assetInfo.borrowCollateralFactor) / 1e18;

          // Collateral assets don't earn interest in Compound V3
          markets.push({
            asset: assetInfo.asset,
            supplyAPY: 0,
            borrowAPY: 0,
            totalSupply: 0,
            totalBorrow: 0,
            utilization: 0,
            collateralFactor,
          });
        } catch (error) {
          logger.warn(`Failed to fetch asset ${i}:`, error);
        }
      }

      return {
        name: 'Compound V3',
        chainId: 1,
        markets,
      };
    } catch (error) {
      logger.error('Error fetching all Compound markets:', error);
      throw error;
    }
  }

  async getUserPosition(userAddress: string): Promise<any> {
    try {
      const balanceABI = [
        'function balanceOf(address account) external view returns (uint256)',
        'function borrowBalanceOf(address account) external view returns (uint256)',
      ];

      const contract = new ethers.Contract(
        COMPOUND_V3_USDC,
        balanceABI,
        this.web3Client.getProvider()
      );

      const [supplyBalance, borrowBalance] = await Promise.all([
        contract.balanceOf(userAddress),
        contract.borrowBalanceOf(userAddress),
      ]);

      return {
        supplied: ethers.formatUnits(supplyBalance, 6),
        borrowed: ethers.formatUnits(borrowBalance, 6),
        netPosition: ethers.formatUnits(supplyBalance - borrowBalance, 6),
      };
    } catch (error) {
      logger.error('Error fetching user position:', error);
      throw error;
    }
  }
}
