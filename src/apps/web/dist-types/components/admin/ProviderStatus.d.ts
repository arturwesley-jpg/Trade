export interface ProviderHealth {
    provider: "binance" | "bybit" | "okx" | "kraken" | "bingx";
    status: "healthy" | "degraded" | "down";
    latencyMs: number;
    lastUpdate: string;
    dataQuality: number;
    priceUsd?: number;
    errorCount: number;
}
export interface PriceConsensus {
    symbol: string;
    consensusPrice: number;
    priceRange: {
        min: number;
        max: number;
    };
    disagreementPct: number;
    providers: Array<{
        name: string;
        price: number;
    }>;
}
interface ProviderStatusProps {
    providers: ProviderHealth[];
    consensus: PriceConsensus[];
    onRefresh?: () => void;
}
export declare function ProviderStatus({ providers, consensus, onRefresh }: ProviderStatusProps): import("react/jsx-runtime").JSX.Element;
export {};
