import { type CandlestickData } from "lightweight-charts";
export interface CandlestickChartProps {
    data: CandlestickData[];
    symbol: string;
    height?: number;
}
export declare const CandlestickChart: import("react").NamedExoticComponent<CandlestickChartProps>;
