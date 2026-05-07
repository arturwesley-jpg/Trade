import { ethers } from 'ethers';
import { Web3Client } from '../web3-client.js';
import { LendingMarket, LendingProtocol } from '../types/index.js';
import { logger } from '@trade/shared';

// Aave V3 Pool address on Ethereum mainnet
const AAVE_V3_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
const AAVE_V3_DATA_PROVIDER = '0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3';

export class AaveClient {
  private web3Client: Web3Client;
  private poolContract: ethers.Contract;
  private dataProviderContract: ethers.Contract;

  constructor(web3Client: Web3Client) {
    this.web3Client = web3Client;

    const poolABI = [
      'function getReserveData(address asset) external view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))',
      'function getUserAccountData(address user) external view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
    ];

    const dataProviderABI = [
      'function getReserveConfigurationData(address asset) external view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)',
      'function getReserveData(address asset) external view returns (uint256 availableLiquidity, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)',
    ];

    this.poolContract = new ethers.Contract(
      AAVE_V3_POOL,
      poolABI,
      this.web3Client.getProvider()
    );

    this.dataProviderContract = new ethers.Contract(
      AAVE_V3_DATA_PROVIDER,
      dataProviderABI,
      this.web3Client.getProvider()
    );
  }

  async getMarketData(assetAddress: string): Promise<LendingMarket> {
    try {
      const [reserveData, configData] = await Promise.all([
        this.dataProviderContract.getReserveData(assetAddress),
        this.dataProviderContract.getReserveConfigurationData(assetAddress),
      ]);

      // Convert rates from ray (1e27) to percentage
      const RAY = 1e27;
      const supplyAPY = (Number(reserveData.liquidityRate) / RAY) * 100;
      const borrowAPY = (Number(reserveData.variableBorrowRate) / RAY) * 100;

      const totalSupply = Number(reserveData.availableLiquidity) +
                         Number(reserveData.totalStableDebt) +
                         Number(reserveData.totalVariableDebt);
      const totalBorrow = Number(reserveData.totalStableDebt) +
                         Number(reserveData.totalVariableDebt);

      const utilization = totalSupply > 0 ? (totalBorrow / totalSupply) * 100 : 0;

      return {
        asset: assetAddress,
        supplyAPY,
        borrowAPY,
        totalSupply,
        totalBorrow,
        utilization,
        collateralFactor: Number(configData.ltv) / 10000, // Convert from basis points
      };
    } catch (error) {
      logger.error('Error fetching Aave market data:', error);
      throw error;
    }
  }

  async getAllMarkets(assets: string[]): Promise<LendingProtocol> {
    try {
      const markets = await Promise.all(
        assets.map(asset => this.getMarketData(asset))
      );

      return {
        name: 'Aave V3',
        chainId: 1,
        markets,
      };
    } catch (error) {
      logger.error('Error fetching all Aave markets:', error);
      throw error;
    }
  }

  async getUserPosition(userAddress: string): Promise<any> {
    try {
      const accountData = await this.poolContract.getUserAccountData(userAddress);

      return {
        totalCollateral: ethers.formatUnits(accountData.totalCollateralBase, 8),
        totalDebt: ethers.formatUnits(accountData.totalDebtBase, 8),
        availableBorrows: ethers.formatUnits(accountData.availableBorrowsBase, 8),
        currentLiquidationThreshold: Number(accountData.currentLiquidationThreshold) / 100,
        ltv: Number(accountData.ltv) / 100,
        healthFactor: ethers.formatUnits(accountData.healthFactor, 18),
      };
    } catch (error) {
      logger.error('Error fetching user position:', error);
      throw error;
    }
  }
}
