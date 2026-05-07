import { ethers } from 'ethers';
import { Web3Client } from '../web3-client.js';
import { TokenPrice, LiquidityPool, SwapEstimate, DEX, TokenInfo } from '../types/index.js';
import { logger } from '@trade/shared';

// Uniswap V3 Router address on Ethereum mainnet
const UNISWAP_V3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const UNISWAP_V3_QUOTER = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

export class UniswapV3Client {
  private web3Client: Web3Client;
  private routerContract: ethers.Contract;
  private factoryContract: ethers.Contract;
  private quoterContract: ethers.Contract;

  constructor(web3Client: Web3Client) {
    this.web3Client = web3Client;

    const routerABI = [
      'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
      'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
    ];

    const factoryABI = [
      'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
    ];

    const quoterABI = [
      'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
    ];

    this.routerContract = new ethers.Contract(
      UNISWAP_V3_ROUTER,
      routerABI,
      this.web3Client.getProvider()
    );

    this.factoryContract = new ethers.Contract(
      UNISWAP_V3_FACTORY,
      factoryABI,
      this.web3Client.getProvider()
    );

    this.quoterContract = new ethers.Contract(
      UNISWAP_V3_QUOTER,
      quoterABI,
      this.web3Client.getProvider()
    );
  }

  async getTokenPrice(tokenAddress: string, baseToken: string = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'): Promise<TokenPrice> {
    try {
      // WETH address on Ethereum mainnet
      const fee = 3000; // 0.3% fee tier
      const amountIn = ethers.parseUnits('1', 18);

      const poolAddress = await this.factoryContract.getPool(tokenAddress, baseToken, fee);

      if (poolAddress === ethers.ZeroAddress) {
        throw new Error('Pool not found');
      }

      // Get pool data
      const poolABI = [
        'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
        'function liquidity() external view returns (uint128)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)',
      ];

      const pool = new ethers.Contract(poolAddress, poolABI, this.web3Client.getProvider());
      const [slot0, liquidity] = await Promise.all([
        pool.slot0(),
        pool.liquidity(),
      ]);

      // Calculate price from sqrtPriceX96
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      const price = Number(sqrtPriceX96) ** 2 / (2 ** 192);

      return {
        token: tokenAddress,
        price,
        priceUSD: price, // Would need to convert via WETH/USD price
        timestamp: Date.now(),
        source: DEX.UNISWAP_V3,
        liquidity: Number(liquidity),
      };
    } catch (error) {
      logger.error('Error fetching Uniswap V3 token price:', error);
      throw error;
    }
  }

  async getPoolInfo(token0: string, token1: string, fee: number = 3000): Promise<LiquidityPool | null> {
    try {
      const poolAddress = await this.factoryContract.getPool(token0, token1, fee);

      if (poolAddress === ethers.ZeroAddress) {
        return null;
      }

      const poolABI = [
        'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
        'function liquidity() external view returns (uint128)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)',
      ];

      const pool = new ethers.Contract(poolAddress, poolABI, this.web3Client.getProvider());
      const [slot0, liquidity, poolToken0, poolToken1] = await Promise.all([
        pool.slot0(),
        pool.liquidity(),
        pool.token0(),
        pool.token1(),
      ]);

      // Get token info
      const tokenABI = [
        'function symbol() view returns (string)',
        'function name() view returns (string)',
        'function decimals() view returns (uint8)',
      ];

      const token0Contract = new ethers.Contract(poolToken0, tokenABI, this.web3Client.getProvider());
      const token1Contract = new ethers.Contract(poolToken1, tokenABI, this.web3Client.getProvider());

      const [token0Info, token1Info] = await Promise.all([
        Promise.all([token0Contract.symbol(), token0Contract.name(), token0Contract.decimals()]),
        Promise.all([token1Contract.symbol(), token1Contract.name(), token1Contract.decimals()]),
      ]);

      const token0Data: TokenInfo = {
        address: poolToken0,
        symbol: token0Info[0],
        name: token0Info[1],
        decimals: token0Info[2],
        chainId: 1,
      };

      const token1Data: TokenInfo = {
        address: poolToken1,
        symbol: token1Info[0],
        name: token1Info[1],
        decimals: token1Info[2],
        chainId: 1,
      };

      return {
        address: poolAddress,
        dex: DEX.UNISWAP_V3,
        token0: token0Data,
        token1: token1Data,
        reserve0: '0', // V3 doesn't have simple reserves
        reserve1: '0',
        totalLiquidity: Number(liquidity),
        volume24h: 0, // Would need to query subgraph
        fee: fee / 10000, // Convert to percentage
        apy: 0, // Would need historical data
      };
    } catch (error) {
      logger.error('Error fetching Uniswap V3 pool info:', error);
      throw error;
    }
  }

  async estimateSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    fee: number = 3000
  ): Promise<SwapEstimate> {
    try {
      const amountInWei = ethers.parseUnits(amountIn, 18);

      // Note: quoter requires static call, not actual transaction
      const amountOut = await this.quoterContract.quoteExactInputSingle.staticCall(
        tokenIn,
        tokenOut,
        fee,
        amountInWei,
        0
      );

      const priceImpact = this.calculatePriceImpact(amountInWei, amountOut);

      return {
        tokenIn,
        tokenOut,
        amountIn: amountInWei.toString(),
        amountOut: amountOut.toString(),
        priceImpact,
        fee: ((amountInWei * BigInt(fee)) / 1000000n).toString(),
        route: [tokenIn, tokenOut],
        gasEstimate: '150000',
      };
    } catch (error) {
      logger.error('Error estimating Uniswap V3 swap:', error);
      throw error;
    }
  }

  private calculatePriceImpact(amountIn: bigint, amountOut: bigint): number {
    // Simplified price impact calculation
    if (amountOut === 0n) return 100;
    const ratio = Number(amountIn) / Number(amountOut);
    return Math.abs((ratio - 1) * 100);
  }
}
