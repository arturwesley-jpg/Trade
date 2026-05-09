/**
 * Sentiment Scoring Algorithm
 *
 * Integrates sentiment data with technical signals to produce
 * enhanced trading signals with sentiment-adjusted confidence.
 */

import type { AggregatedSignal } from '@trade/shared';
import type { AggregatedSentiment } from '../types';

export interface SentimentScoringConfig {
  sentimentWeight?: number; // Weight of sentiment in final score (0-1, default: 0.3)
  minSentimentConfidence?: number; // Minimum sentiment confidence to apply (default: 50)
}

export interface EnhancedSignal extends AggregatedSignal {
  sentiment: {
    score: number;
    sentiment: AggregatedSentiment['sentiment'];
    confidence: number;
    impact: number; // How much sentiment affected the signal (-1 to 1)
  };
  adjustedConfidence: number; // Original confidence adjusted by sentiment
  adjustedSignal: 'BUY' | 'SELL' | 'NEUTRAL';
}

export class SentimentScoring {
  private sentimentWeight: number;
  private minSentimentConfidence: number;

  constructor(config: SentimentScoringConfig = {}) {
    this.sentimentWeight = config.sentimentWeight ?? 0.3;
    this.minSentimentConfidence = config.minSentimentConfidence ?? 50;
  }

  /**
   * Enhance technical signal with sentiment data
   */
  enhanceSignal(
    technicalSignal: AggregatedSignal,
    sentiment: AggregatedSentiment
  ): EnhancedSignal {
    // Only apply sentiment if confidence is sufficient
    if (sentiment.confidence < this.minSentimentConfidence) {
      return {
        ...technicalSignal,
        sentiment: {
          score: sentiment.overallScore,
          sentiment: sentiment.sentiment,
          confidence: sentiment.confidence,
          impact: 0,
        },
        adjustedConfidence: technicalSignal.confidence,
        adjustedSignal: technicalSignal.signal,
      };
    }

    // Calculate sentiment impact
    const impact = this.calculateImpact(technicalSignal, sentiment);

    // Adjust confidence based on sentiment alignment
    const adjustedConfidence = this.adjustConfidence(
      technicalSignal.confidence,
      technicalSignal.signal,
      sentiment.overallScore,
      sentiment.confidence
    );

    // Determine adjusted signal
    const adjustedSignal = this.determineAdjustedSignal(
      technicalSignal,
      sentiment,
      adjustedConfidence
    );

    return {
      ...technicalSignal,
      sentiment: {
        score: sentiment.overallScore,
        sentiment: sentiment.sentiment,
        confidence: sentiment.confidence,
        impact,
      },
      adjustedConfidence,
      adjustedSignal,
    };
  }

  /**
   * Calculate sentiment impact on signal
   */
  private calculateImpact(
    technicalSignal: AggregatedSignal,
    sentiment: AggregatedSentiment
  ): number {
    const technicalScore = this.signalToScore(technicalSignal.signal);
    const sentimentScore = sentiment.overallScore;

    // Impact is the difference between sentiment and technical signal
    // weighted by sentiment confidence
    const rawImpact = sentimentScore - technicalScore;
    const weightedImpact = rawImpact * (sentiment.confidence / 100) * this.sentimentWeight;

    return Math.max(-1, Math.min(1, weightedImpact));
  }

  /**
   * Adjust confidence based on sentiment alignment
   */
  private adjustConfidence(
    technicalConfidence: number,
    technicalSignal: 'BUY' | 'SELL' | 'NEUTRAL',
    sentimentScore: number,
    sentimentConfidence: number
  ): number {
    const technicalScore = this.signalToScore(technicalSignal);

    // Check alignment
    const aligned = this.areAligned(technicalScore, sentimentScore);

    if (aligned) {
      // Sentiment confirms technical signal - boost confidence
      const boost = (sentimentConfidence / 100) * this.sentimentWeight * 20;
      return Math.min(100, technicalConfidence + boost);
    } else {
      // Sentiment contradicts technical signal - reduce confidence
      const penalty = (sentimentConfidence / 100) * this.sentimentWeight * 15;
      return Math.max(0, technicalConfidence - penalty);
    }
  }

  /**
   * Determine adjusted signal after sentiment integration
   */
  private determineAdjustedSignal(
    technicalSignal: AggregatedSignal,
    sentiment: AggregatedSentiment,
    adjustedConfidence: number
  ): 'BUY' | 'SELL' | 'NEUTRAL' {
    // If adjusted confidence is too low, return neutral
    if (adjustedConfidence < 50) {
      return 'NEUTRAL';
    }

    const technicalScore = this.signalToScore(technicalSignal.signal);
    const sentimentScore = sentiment.overallScore;

    // Combine technical and sentiment scores
    const combinedScore =
      technicalScore * (1 - this.sentimentWeight) +
      sentimentScore * this.sentimentWeight * (sentiment.confidence / 100);

    // Determine signal from combined score
    if (combinedScore > 0.2) return 'BUY';
    if (combinedScore < -0.2) return 'SELL';
    return 'NEUTRAL';
  }

  /**
   * Check if technical and sentiment signals are aligned
   */
  private areAligned(technicalScore: number, sentimentScore: number): boolean {
    // Both bullish
    if (technicalScore > 0 && sentimentScore > 0) return true;
    // Both bearish
    if (technicalScore < 0 && sentimentScore < 0) return true;
    // Both neutral (within threshold)
    if (Math.abs(technicalScore) < 0.2 && Math.abs(sentimentScore) < 0.2) return true;
    return false;
  }

  /**
   * Convert signal to numeric score
   */
  private signalToScore(signal: 'BUY' | 'SELL' | 'NEUTRAL'): number {
    if (signal === 'BUY') return 1;
    if (signal === 'SELL') return -1;
    return 0;
  }

  /**
   * Batch enhance signals with sentiment
   */
  enhanceSignalsBatch(
    signals: AggregatedSignal[],
    sentiments: Map<string, AggregatedSentiment>
  ): EnhancedSignal[] {
    return signals.map((signal) => {
      const sentiment = sentiments.get(signal.symbol);
      if (!sentiment) {
        // No sentiment data - return signal with neutral sentiment
        return {
          ...signal,
          sentiment: {
            score: 0,
            sentiment: 'NEUTRAL' as const,
            confidence: 0,
            impact: 0,
          },
          adjustedConfidence: signal.confidence,
          adjustedSignal: signal.signal,
        };
      }
      return this.enhanceSignal(signal, sentiment);
    });
  }
}
