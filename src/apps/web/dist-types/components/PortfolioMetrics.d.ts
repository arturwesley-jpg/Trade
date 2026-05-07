/**
 * Portfolio Metrics Component
 * Displays real-time portfolio performance with visual indicators
 */
interface PortfolioMetricsProps {
    totalValue: number;
    totalPnL: number;
    pnlPercentage: number;
    openPositions: number;
}
export declare const PortfolioMetrics: import("react").NamedExoticComponent<PortfolioMetricsProps>;
export {};
