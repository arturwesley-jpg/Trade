import type { Position, PaperSummary } from "../shared-types.js";
export interface AnalyticsPageProps {
    positions: Position[];
    paperSummary: PaperSummary | null;
}
export declare function AnalyticsPage({ positions, paperSummary }: AnalyticsPageProps): import("react/jsx-runtime").JSX.Element;
