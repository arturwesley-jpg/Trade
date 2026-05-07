import { ethers } from 'ethers';
import { Web3Config, TokenPrice, SwapEstimate, GasPrice, TransactionSimulation } from './types/index.js';
import { logger } from '@trade/shared';

export class Web3Client {
  private provider: ethers.JsonRpcProvider;
  private wallet?: ethers.Wallet;
  private config: Web3Config;

  constructor(config: Web3Config) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    if (config.privateKey) {
      this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    }
  }

  async getTokenPrice(tokenAddress: string): Promise<number> {
    try {
      // This is a simplified implementation
      // In production, you'd query DEX pools or price oracles
      const token = new ethers.Contract(
        tokenAddress,
        ['function decimals() view returns (uint8)'],
        this.provider
      );

      const decimals = await token.decimals();
      logger.info(`Token ${tokenAddress} has ${decimals} decimals`);

      // Price would be fetched from DEX pools
      return 0;
    } catch (error) {
      logger.error('Error fetching token price:', error);
      throw error;
    }
  }

  async getPoolLiquidity(poolAddress: string): Promise<number> {
    try {
      const poolABI = [
        'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
        'function token0() view returns (address)',
        'function token1() view returns (address)',
      ];

      const pool = new ethers.Contract(poolAddress, poolABI, this.provider);
      const reserves = await pool.getReserves();

      // Calculate liquidity based on reserves
      const liquidity = Number(reserves.reserve0) + Number(reserves.reserve1);
      return liquidity;
    } catch (error) {
      logger.error('Error fetching pool liquidity:', error);
      throw error;
    }
  }

  async getGasPrice(): Promise<number> {
    try {
      const feeData = await this.provider.getFeeData();
      return Number(feeData.gasPrice || 0n);
    } catch (error) {
      logger.error('Error fetching gas price:', error);
      throw error;
    }
  }

  async getDetailedGasPrice(): Promise<GasPrice> {
    try {
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || 0n;
      const maxFeePerGas = feeData.maxFeePerGas || 0n;
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || 0n;

      return {
        slow: ethers.formatUnits(gasPrice * 80n / 100n, 'gwei'),
        standard: ethers.formatUnits(gasPrice, 'gwei'),
        fast: ethers.formatUnits(gasPrice * 120n / 100n, 'gwei'),
        instant: ethers.formatUnits(gasPrice * 150n / 100n, 'gwei'),
        baseFee: ethers.formatUnits(maxFeePerGas, 'gwei'),
        priorityFee: ethers.formatUnits(maxPriorityFeePerGas, 'gwei'),
      };
    } catch (error) {
      logger.error('Error fetching detailed gas price:', error);
      throw error;
    }
  }

  async estimateSwap(
    tokenIn: string,
    tokenOut: string,
    amount: number
  ): Promise<SwapEstimate> {
    try {
      // This would integrate with DEX routers
      // Simplified implementation
      const amountIn = ethers.parseUnits(amount.toString(), 18);

      return {
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        amountOut: '0', // Would be calculated from DEX
        priceImpact: 0,
        fee: '0',
        route: [tokenIn, tokenOut],
        gasEstimate: '150000',
      };
    } catch (error) {
      logger.error('Error estimating swap:', error);
      throw error;
    }
  }

  async simulateTransaction(
    to: string,
    data: string,
    value: bigint = 0n
  ): Promise<TransactionSimulation> {
    try {
      if (!this.wallet) {
        throw new Error('Wallet not configured for simulation');
      }

      const tx = {
        to,
        data,
        value,
      };

      const gasEstimate = await this.provider.estimateGas(tx);
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || 0n;
      const totalCost = gasEstimate * gasPrice;

      return {
        success: true,
        gasUsed: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        totalCost: ethers.formatEther(totalCost),
      };
    } catch (error: any) {
      logger.error('Transaction simulation failed:', error);
      return {
        success: false,
        gasUsed: '0',
        gasPrice: '0',
        totalCost: '0',
        error: error.message,
      };
    }
  }

  async getBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    const tokenABI = ['function balanceOf(address) view returns (uint256)'];
    const token = new ethers.Contract(tokenAddress, tokenABI, this.provider);
    const balance = await token.balanceOf(walletAddress);
    return balance.toString();
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getWallet(): ethers.Wallet | undefined {
    return this.wallet;
  }
}
