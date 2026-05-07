import { UniswapV3Client } from './uniswap-v3.js';
import { PancakeSwapClient } from './pancakeswap.js';
import { QuickSwapClient } from './quickswap.js';
import { Web3Client } from '../web3-client.js';
import { TokenPrice, LiquidityPool, SwapEstimate, DEX } from '../types/index.js';
import { logger } from '@trade/shared';

export class DEXAggregator {
  private uniswapV3: UniswapV3Client;
  private pancakeswap: PancakeSwapClient;
  private quickswap: QuickSwapClient;

  constructor(
    ethereumClient: Web3Client,
    bscClient: Web3Client,
    polygonClient: Web3Client
  ) {
    this.uniswapV3 = new UniswapV3Client(ethereumClient);
    this.pancakeswap = new PancakeSwapClient(bscClient);
    this.quickswap = new QuickSwapClient(polygonClient);
  }

  async getBestPrice(tokenAddress: string, chainId: number): Promise<TokenPrice> {
    try {
      switch (chainId) {
        case 1: // Ethereum
          return await this.uniswapV3.getTokenPrice(tokenAddress);
        case 56: // BSC
          return await this.pancakeswap.getTokenPrice(tokenAddress);
        case 137: // Polygon
          return await this.quickswap.getTokenPrice(tokenAddress);
        default:
          throw new Error(`Unsupported chain ID: ${chainId}`);
      }
    } catch (error) {
      logger.error('Error getting best price:', error);
      throw error;
    }
  }

  async getAllPrices(tokenAddress: string): Promise<TokenPrice[]> {
    const prices: TokenPrice[] = [];

    try {
      const uniswapPrice = await this.uniswapV3.getTokenPrice(tokenAddress);
      prices.push(uniswapPrice);
    } catch (error) {
      logger.warn('Failed to fetch Uniswap price:', error);
    }

    try {
      const pancakePrice = await this.pancakeswap.getTokenPrice(tokenAddress);
      prices.push(pancakePrice);
    } catch (error) {
      logger.warn('Failed to fetch PancakeSwap price:', error);
    }

    try {
      const quickswapPrice = await this.quickswap.getTokenPrice(tokenAddress);
      prices.push(quickswapPrice);
    } catch (error) {
      logger.warn('Failed to fetch QuickSwap price:', error);
    }

    return prices;
  }

  async findBestSwapRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    chainId: number
  ): Promise<SwapEstimate> {
    try {
      switch (chainId) {
        case 1: // Ethereum
          return await this.uniswapV3.estimateSwap(tokenIn, tokenOut, amountIn);
        case 56: // BSC
          return await this.pancakeswap.estimateSwap(tokenIn, tokenOut, amountIn);
        case 137: // Polygon
          return await this.quickswap.estimateSwap(tokenIn, tokenOut, amountIn);
        default:
          throw new Error(`Unsupported chain ID: ${chainId}`);
      }
    } catch (error) {
      logger.error('Error finding best swap route:', error);
      throw error;
    }
  }

  async getLiquidityPools(token0: string, token1: string, chainId: number): Promise<LiquidityPool[]> {
    const pools: LiquidityPool[] = [];

    try {
      switch (chainId) {
        case 1: // Ethereum
          const uniswapPool = await this.uniswapV3.getPoolInfo(token0, token1);
          if (uniswapPool) pools.push(uniswapPool);
          break;
        case 56: // BSC
          const pancakePool = await this.pancakeswap.getPoolInfo(token0, token1);
          if (pancakePool) pools.push(pancakePool);
          break;
        case 137: // Polygon
          const quickswapPool = await this.quickswap.getPoolInfo(token0, token1);
          if (quickswapPool) pools.push(quickswapPool);
          break;
        default:
          throw new Error(`Unsupported chain ID: ${chainId}`);
      }
    } catch (error) {
      logger.error('Error getting liquidity pools:', error);
      throw error;
    }

    return pools;
  }
}

export { UniswapV3Client, PancakeSwapClient, QuickSwapClient };
