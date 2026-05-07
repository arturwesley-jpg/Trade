/**
 * Equity Curve Chart Component
 * Displays portfolio equity over time using lightweight-charts
 */
interface EquityPoint {
    timestamp: number;
    equity: number;
}
interface EquityCurveChartProps {
    data: EquityPoint[];
    height?: number;
}
export declare const EquityCurveChart: import("react").NamedExoticComponent<EquityCurveChartProps>;
export {};
