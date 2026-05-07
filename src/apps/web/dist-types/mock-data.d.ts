import type { CandlestickData, LineData } from "lightweight-charts";
import type { Trade } from "./components/TradesHistory.js";
export declare function generateMockCandlestickData(symbol: string, days?: number): CandlestickData[];
export declare function generateMockEquityCurve(trades: Trade[]): LineData[];
export declare function generateMockTrades(count?: number): Trade[];
