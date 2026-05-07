import { ethers } from 'ethers';
import { Web3Client } from '../web3-client.js';
import { TokenPrice, LiquidityPool, SwapEstimate, DEX, TokenInfo } from '../types/index.js';
import { logger } from '@trade/shared';

// QuickSwap Router on Polygon
const QUICKSWAP_ROUTER = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff';
const QUICKSWAP_FACTORY = '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32';

export class QuickSwapClient {
  private web3Client: Web3Client;
  private routerContract: ethers.Contract;
  private factoryContract: ethers.Contract;

  constructor(web3Client: Web3Client) {
    this.web3Client = web3Client;

    const routerABI = [
      'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    ];

    const factoryABI = [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)',
    ];

    this.routerContract = new ethers.Contract(
      QUICKSWAP_ROUTER,
      routerABI,
      this.web3Client.getProvider()
    );

    this.factoryContract = new ethers.Contract(
      QUICKSWAP_FACTORY,
      factoryABI,
      this.web3Client.getProvider()
    );
  }

  async getTokenPrice(tokenAddress: string, baseToken: string = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'): Promise<TokenPrice> {
    try {
      // WMATIC address on Polygon
      const amountIn = ethers.parseUnits('1', 18);
      const path = [tokenAddress, baseToken];

      const amounts = await this.routerContract.getAmountsOut(amountIn, path);
      const price = Number(ethers.formatUnits(amounts[1], 18));

      return {
        token: tokenAddress,
        price,
        priceUSD: price,
        timestamp: Date.now(),
        source: DEX.QUICKSWAP,
        liquidity: 0,
      };
    } catch (error) {
      logger.error('Error fetching QuickSwap token price:', error);
      throw error;
    }
  }

  async getPoolInfo(token0: string, token1: string): Promise<LiquidityPool | null> {
    try {
      const pairAddress = await this.factoryContract.getPair(token0, token1);

      if (pairAddress === ethers.ZeroAddress) {
        return null;
      }

      const pairABI = [
        'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)',
        'function totalSupply() external view returns (uint)',
      ];

      const pair = new ethers.Contract(pairAddress, pairABI, this.web3Client.getProvider());
      const [reserves, pairToken0, pairToken1, totalSupply] = await Promise.all([
        pair.getReserves(),
        pair.token0(),
        pair.token1(),
        pair.totalSupply(),
      ]);

      const tokenABI = [
        'function symbol() view returns (string)',
        'function name() view returns (string)',
        'function decimals() view returns (uint8)',
      ];

      const token0Contract = new ethers.Contract(pairToken0, tokenABI, this.web3Client.getProvider());
      const token1Contract = new ethers.Contract(pairToken1, tokenABI, this.web3Client.getProvider());

      const [token0Info, token1Info] = await Promise.all([
        Promise.all([token0Contract.symbol(), token0Contract.name(), token0Contract.decimals()]),
        Promise.all([token1Contract.symbol(), token1Contract.name(), token1Contract.decimals()]),
      ]);

      const token0Data: TokenInfo = {
        address: pairToken0,
        symbol: token0Info[0],
        name: token0Info[1],
        decimals: token0Info[2],
        chainId: 137,
      };

      const token1Data: TokenInfo = {
        address: pairToken1,
        symbol: token1Info[0],
        name: token1Info[1],
        decimals: token1Info[2],
        chainId: 137,
      };

      return {
        address: pairAddress,
        dex: DEX.QUICKSWAP,
        token0: token0Data,
        token1: token1Data,
        reserve0: reserves.reserve0.toString(),
        reserve1: reserves.reserve1.toString(),
        totalLiquidity: Number(totalSupply),
        volume24h: 0,
        fee: 0.3, // QuickSwap fee
        apy: 0,
      };
    } catch (error) {
      logger.error('Error fetching QuickSwap pool info:', error);
      throw error;
    }
  }

  async estimateSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<SwapEstimate> {
    try {
      const amountInWei = ethers.parseUnits(amountIn, 18);
      const path = [tokenIn, tokenOut];

      const amounts = await this.routerContract.getAmountsOut(amountInWei, path);
      const amountOut = amounts[1];

      const priceImpact = this.calculatePriceImpact(amountInWei, amountOut);
      const fee = (amountInWei * 30n) / 10000n; // 0.3% fee

      return {
        tokenIn,
        tokenOut,
        amountIn: amountInWei.toString(),
        amountOut: amountOut.toString(),
        priceImpact,
        fee: fee.toString(),
        route: path,
        gasEstimate: '100000',
      };
    } catch (error) {
      logger.error('Error estimating QuickSwap swap:', error);
      throw error;
    }
  }

  private calculatePriceImpact(amountIn: bigint, amountOut: bigint): number {
    if (amountOut === 0n) return 100;
    const ratio = Number(amountIn) / Number(amountOut);
    return Math.abs((ratio - 1) * 100);
  }
}
