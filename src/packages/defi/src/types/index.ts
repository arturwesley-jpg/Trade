export enum Chain {
  ETHEREUM = 1,
  BSC = 56,
  POLYGON = 137,
  ARBITRUM = 42161,
  OPTIMISM = 10,
  AVALANCHE = 43114,
}

export enum DEX {
  UNISWAP_V3 = 'uniswap_v3',
  PANCAKESWAP = 'pancakeswap',
  QUICKSWAP = 'quickswap',
  SUSHISWAP = 'sushiswap',
}

export interface Web3Config {
  rpcUrl: string;
  chainId: number;
  privateKey?: string;
  apiKey?: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
}

export interface TokenPrice {
  token: string;
  price: number;
  priceUSD: number;
  timestamp: number;
  source: DEX;
  liquidity: number;
}

export interface LiquidityPool {
  address: string;
  dex: DEX;
  token0: TokenInfo;
  token1: TokenInfo;
  reserve0: string;
  reserve1: string;
  totalLiquidity: number;
  volume24h: number;
  fee: number;
  apy: number;
}

export interface SwapEstimate {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  fee: string;
  route: string[];
  gasEstimate: string;
}

export interface YieldOpportunity {
  protocol: string;
  type: 'lending' | 'staking' | 'liquidity' | 'farming';
  asset: string;
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
  chainId: number;
  poolAddress?: string;
}

export interface LendingProtocol {
  name: string;
  chainId: number;
  markets: LendingMarket[];
}

export interface LendingMarket {
  asset: string;
  supplyAPY: number;
  borrowAPY: number;
  totalSupply: number;
  totalBorrow: number;
  utilization: number;
  collateralFactor: number;
}

export interface StakingPool {
  protocol: string;
  asset: string;
  rewardToken: string;
  apy: number;
  tvl: number;
  lockPeriod?: number;
  minStake?: string;
}

export interface GasPrice {
  slow: string;
  standard: string;
  fast: string;
  instant: string;
  baseFee?: string;
  priorityFee?: string;
}

export interface TransactionSimulation {
  success: boolean;
  gasUsed: string;
  gasPrice: string;
  totalCost: string;
  output?: any;
  error?: string;
}

export interface DeFiError {
  code: string;
  message: string;
  details?: any;
}
