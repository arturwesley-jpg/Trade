/**
 * Position Card Component
 * Displays individual position with TP/SL visualization and real-time PnL
 */
interface Position {
    id: string;
    symbol: string;
    side: "LONG" | "SHORT";
    entryPrice: number;
    currentPrice: number;
    size: number;
    leverage: number;
    marginUsdt: number;
    unrealizedPnl: number;
    unrealizedPnlPct: number;
    takeProfit?: number;
    stopLoss?: number;
    status: "OPEN" | "CLOSED";
}
interface PositionCardProps {
    position: Position;
    onClose?: (id: string) => void;
    onEdit?: (id: string) => void;
}
export declare const PositionCard: import("react").NamedExoticComponent<PositionCardProps>;
export {};
