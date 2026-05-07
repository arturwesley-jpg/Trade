import type { Position } from "../../shared-types.js";
export interface PaperMetrics {
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: number;
    maxDrawdown: number;
    maxDrawdownPct: number;
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;
    equityCurve: Array<{
        timestamp: string;
        equity: number;
    }>;
    tradesBySymbol: Record<string, number>;
}
interface PaperMetricsProps {
    metrics: PaperMetrics;
    recentTrades: Position[];
}
export declare function PaperMetrics({ metrics, recentTrades }: PaperMetricsProps): import("react/jsx-runtime").JSX.Element;
export {};
