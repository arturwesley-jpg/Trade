import { ethers } from 'ethers';
import { Web3Client } from '../web3-client.js';
import { TokenPrice, LiquidityPool, SwapEstimate, DEX, TokenInfo } from '../types/index.js';
import { logger } from '@trade/shared';

// PancakeSwap Router on BSC
const PANCAKESWAP_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const PANCAKESWAP_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';

export class PancakeSwapClient {
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
      PANCAKESWAP_ROUTER,
      routerABI,
      this.web3Client.getProvider()
    );

    this.factoryContract = new ethers.Contract(
      PANCAKESWAP_FACTORY,
      factoryABI,
      this.web3Client.getProvider()
    );
  }

  async getTokenPrice(tokenAddress: string, baseToken: string = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'): Promise<TokenPrice> {
    try {
      // WBNB address on BSC
      const amountIn = ethers.parseUnits('1', 18);
      const path = [tokenAddress, baseToken];

      const amounts = await this.routerContract.getAmountsOut(amountIn, path);
      const price = Number(ethers.formatUnits(amounts[1], 18));

      return {
        token: tokenAddress,
        price,
        priceUSD: price,
        timestamp: Date.now(),
        source: DEX.PANCAKESWAP,
        liquidity: 0,
      };
    } catch (error) {
      logger.error('Error fetching PancakeSwap token price:', error);
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
        chainId: 56,
      };

      const token1Data: TokenInfo = {
        address: pairToken1,
        symbol: token1Info[0],
        name: token1Info[1],
        decimals: token1Info[2],
        chainId: 56,
      };

      return {
        address: pairAddress,
        dex: DEX.PANCAKESWAP,
        token0: token0Data,
        token1: token1Data,
        reserve0: reserves.reserve0.toString(),
        reserve1: reserves.reserve1.toString(),
        totalLiquidity: Number(totalSupply),
        volume24h: 0,
        fee: 0.25, // PancakeSwap fee
        apy: 0,
      };
    } catch (error) {
      logger.error('Error fetching PancakeSwap pool info:', error);
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
      const fee = (amountInWei * 25n) / 10000n; // 0.25% fee

      return {
        tokenIn,
        tokenOut,
        amountIn: amountInWei.toString(),
        amountOut: amountOut.toString(),
        priceImpact,
        fee: fee.toString(),
        route: path,
        gasEstimate: '120000',
      };
    } catch (error) {
      logger.error('Error estimating PancakeSwap swap:', error);
      throw error;
    }
  }

  private calculatePriceImpact(amountIn: bigint, amountOut: bigint): number {
    if (amountOut === 0n) return 100;
    const ratio = Number(amountIn) / Number(amountOut);
    return Math.abs((ratio - 1) * 100);
  }
}
