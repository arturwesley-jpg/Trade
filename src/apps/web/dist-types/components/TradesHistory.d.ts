export interface Trade {
    id: string;
    symbol: string;
    side: "LONG" | "SHORT";
    entryPrice: number;
    exitPrice: number;
    entryTime: number;
    exitTime: number;
    pnl: number;
    pnlPercent: number;
    marginUsdt: number;
    leverage: number;
    status: "WIN" | "LOSS" | "BREAKEVEN";
}
export interface TradesHistoryProps {
    trades: Trade[];
}
export declare function TradesHistory({ trades }: TradesHistoryProps): import("react/jsx-runtime").JSX.Element;
