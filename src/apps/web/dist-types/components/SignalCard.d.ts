/**
 * Signal Card Component
 * Displays trading signal with confidence indicator and actionable insights
 */
interface Signal {
    id: string;
    symbol: string;
    direction: "LONG" | "SHORT" | "NEUTRAL";
    confidence: number;
    status: string;
    reason?: string;
    rationale?: string;
    spreadPct?: number;
    sources?: string[];
}
interface SignalCardProps {
    signal: Signal;
    index: number;
}
export declare const SignalCard: import("react").NamedExoticComponent<SignalCardProps>;
export {};
