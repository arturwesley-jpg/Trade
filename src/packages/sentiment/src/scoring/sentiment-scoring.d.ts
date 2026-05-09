/**
 * Sentiment Scoring Algorithm
 *
 * Integrates sentiment data with technical signals to produce
 * enhanced trading signals with sentiment-adjusted confidence.
 */
import type { AggregatedSignal } from '@trade/shared';
import type { AggregatedSentiment } from '../types';
export interface SentimentScoringConfig {
    sentimentWeight?: number;
    minSentimentConfidence?: number;
}
export interface EnhancedSignal extends AggregatedSignal {
    sentiment: {
        score: number;
        sentiment: AggregatedSentiment['sentiment'];
        confidence: number;
        impact: number;
    };
    adjustedConfidence: number;
    adjustedSignal: 'BUY' | 'SELL' | 'NEUTRAL';
}
export declare class SentimentScoring {
    private sentimentWeight;
    private minSentimentConfidence;
    constructor(config?: SentimentScoringConfig);
    /**
     * Enhance technical signal with sentiment data
     */
    enhanceSignal(technicalSignal: AggregatedSignal, sentiment: AggregatedSentiment): EnhancedSignal;
    /**
     * Calculate sentiment impact on signal
     */
    private calculateImpact;
    /**
     * Adjust confidence based on sentiment alignment
     */
    private adjustConfidence;
    /**
     * Determine adjusted signal after sentiment integration
     */
    private determineAdjustedSignal;
    /**
     * Check if technical and sentiment signals are aligned
     */
    private areAligned;
    /**
     * Convert signal to numeric score
     */
    private signalToScore;
    /**
     * Batch enhance signals with sentiment
     */
    enhanceSignalsBatch(signals: AggregatedSignal[], sentiments: Map<string, AggregatedSentiment>): EnhancedSignal[];
}
