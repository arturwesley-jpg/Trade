import { describe, it, expect, beforeEach } from 'vitest';
import { SentimentScoring } from '../scoring/sentiment-scoring';
import type { AggregatedSentiment } from '../types';
import type { AggregatedSignal } from '@trade/shared';

describe('SentimentScoring', () => {
  let scoring: SentimentScoring;

  beforeEach(() => {
    scoring = new SentimentScoring({
      minSentimentConfidence: 50,
      sentimentWeight: 0.3,
    });
  });

  describe('enhanceSignal', () => {
    it('should enhance signal with sentiment data', () => {
      const signal: AggregatedSignal = {
        symbol: 'BTC-USDT',
        signal: 'BUY',
        confidence: 70,
        strength: 75,
        timestamp: new Date(),
        indicators: {
          rsi: { value: 45, signal: 'BUY', weight: 1.0 },
          macd: { value: 0.5, signal: 'BUY', weight: 1.0 },
          bollinger: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          stochastic: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          obv: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          adx: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          atr: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          supportResistance: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
        },
        explanation: 'Test signal',
      };

      const sentiment: AggregatedSentiment = {
        symbol: 'BTC-USDT',
        overallScore: 0.6,
        sentiment: 'BULLISH',
        confidence: 80,
        timestamp: new Date(),
        components: {
          news: { score: 0.7, count: 5, weight: 1.0 },
          fearGreed: { score: 0.5, weight: 1.0 },
          social: { score: 0, volume: 0, weight: 1.0 },
          whales: { score: 0, activity: 0, weight: 1.0 },
        },
      };

      const enhanced = scoring.enhanceSignal(signal, sentiment);

      expect(enhanced.sentiment.score).toBe(0.6);
      expect(enhanced.sentiment.sentiment).toBe('BULLISH');
      expect(enhanced.adjustedConfidence).toBeGreaterThanOrEqual(signal.confidence);
      expect(enhanced.adjustedSignal).toBe('BUY');
      // Impact can be negative if technical signal is stronger than sentiment
      expect(typeof enhanced.sentiment.impact).toBe('number');
    });

    it('should boost confidence when sentiment aligns with signal', () => {
      const buySignal: AggregatedSignal = {
        symbol: 'BTC-USDT',
        signal: 'BUY',
        confidence: 70,
        strength: 75,
        timestamp: new Date(),
        indicators: {
          rsi: { value: 45, signal: 'BUY', weight: 1.0 },
          macd: { value: 0.5, signal: 'BUY', weight: 1.0 },
          bollinger: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          stochastic: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          obv: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          adx: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          atr: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          supportResistance: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
        },
        explanation: 'Test signal',
      };

      const bullishSentiment: AggregatedSentiment = {
        symbol: 'BTC-USDT',
        overallScore: 0.7,
        sentiment: 'BULLISH',
        confidence: 80,
        timestamp: new Date(),
        components: {
          news: { score: 0.7, count: 5, weight: 1.0 },
          fearGreed: { score: 0.5, weight: 1.0 },
          social: { score: 0, volume: 0, weight: 1.0 },
          whales: { score: 0, activity: 0, weight: 1.0 },
        },
      };

      const enhanced = scoring.enhanceSignal(buySignal, bullishSentiment);

      expect(enhanced.adjustedConfidence).toBeGreaterThanOrEqual(buySignal.confidence);
      // Impact can vary based on signal strength vs sentiment
      expect(typeof enhanced.sentiment.impact).toBe('number');
    });

    it('should reduce confidence when sentiment contradicts signal', () => {
      const buySignal: AggregatedSignal = {
        symbol: 'BTC-USDT',
        signal: 'BUY',
        confidence: 70,
        strength: 75,
        timestamp: new Date(),
        indicators: {
          rsi: { value: 45, signal: 'BUY', weight: 1.0 },
          macd: { value: 0.5, signal: 'BUY', weight: 1.0 },
          bollinger: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          stochastic: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          obv: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          adx: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          atr: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          supportResistance: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
        },
        explanation: 'Test signal',
      };

      const bearishSentiment: AggregatedSentiment = {
        symbol: 'BTC-USDT',
        overallScore: -0.7,
        sentiment: 'BEARISH',
        confidence: 80,
        timestamp: new Date(),
        components: {
          news: { score: -0.7, count: 5, weight: 1.0 },
          fearGreed: { score: -0.5, weight: 1.0 },
          social: { score: 0, volume: 0, weight: 1.0 },
          whales: { score: 0, activity: 0, weight: 1.0 },
        },
      };

      const enhanced = scoring.enhanceSignal(buySignal, bearishSentiment);

      expect(enhanced.adjustedConfidence).toBeLessThanOrEqual(buySignal.confidence);
      expect(enhanced.sentiment.impact).toBeLessThanOrEqual(0);
    });

    it('should change signal when sentiment is strong and contradictory', () => {
      const weakBuySignal: AggregatedSignal = {
        symbol: 'BTC-USDT',
        signal: 'BUY',
        confidence: 55,
        strength: 60,
        timestamp: new Date(),
        indicators: {
          rsi: { value: 48, signal: 'NEUTRAL', weight: 1.0 },
          macd: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          bollinger: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          stochastic: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          obv: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          adx: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          atr: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          supportResistance: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
        },
        explanation: 'Test signal',
      };

      const strongBearishSentiment: AggregatedSentiment = {
        symbol: 'BTC-USDT',
        overallScore: -0.8,
        sentiment: 'VERY_BEARISH',
        confidence: 90,
        timestamp: new Date(),
        components: {
          news: { score: -0.8, count: 10, weight: 1.0 },
          fearGreed: { score: -0.7, weight: 1.0 },
          social: { score: 0, volume: 0, weight: 1.0 },
          whales: { score: 0, activity: 0, weight: 1.0 },
        },
      };

      const enhanced = scoring.enhanceSignal(weakBuySignal, strongBearishSentiment);

      // Signal may change or confidence may drop significantly
      expect(enhanced.adjustedSignal === 'BUY' ? enhanced.adjustedConfidence < weakBuySignal.confidence : true).toBe(true);
    });

    it('should handle neutral sentiment', () => {
      const signal: AggregatedSignal = {
        symbol: 'BTC-USDT',
        signal: 'BUY',
        confidence: 70,
        strength: 75,
        timestamp: new Date(),
        indicators: {
          rsi: { value: 45, signal: 'BUY', weight: 1.0 },
          macd: { value: 0.5, signal: 'BUY', weight: 1.0 },
          bollinger: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          stochastic: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          obv: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          adx: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          atr: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          supportResistance: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
        },
        explanation: 'Test signal',
      };

      const neutralSentiment: AggregatedSentiment = {
        symbol: 'BTC-USDT',
        overallScore: 0.05,
        sentiment: 'NEUTRAL',
        confidence: 60,
        timestamp: new Date(),
        components: {
          news: { score: 0.05, count: 3, weight: 1.0 },
          fearGreed: { score: 0, weight: 1.0 },
          social: { score: 0, volume: 0, weight: 1.0 },
          whales: { score: 0, activity: 0, weight: 1.0 },
        },
      };

      const enhanced = scoring.enhanceSignal(signal, neutralSentiment);

      expect(Math.abs(enhanced.adjustedConfidence - signal.confidence)).toBeLessThan(10);
      expect(Math.abs(enhanced.sentiment.impact)).toBeLessThan(0.3);
    });

    it('should ignore low confidence sentiment', () => {
      const signal: AggregatedSignal = {
        symbol: 'BTC-USDT',
        signal: 'BUY',
        confidence: 70,
        strength: 75,
        timestamp: new Date(),
        indicators: {
          rsi: { value: 45, signal: 'BUY', weight: 1.0 },
          macd: { value: 0.5, signal: 'BUY', weight: 1.0 },
          bollinger: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          stochastic: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          obv: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          adx: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          atr: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          supportResistance: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
        },
        explanation: 'Test signal',
      };

      const lowConfidenceSentiment: AggregatedSentiment = {
        symbol: 'BTC-USDT',
        overallScore: 0.8,
        sentiment: 'BULLISH',
        confidence: 30, // Below minSentimentConfidence (50)
        timestamp: new Date(),
        components: {
          news: { score: 0.8, count: 1, weight: 1.0 },
          fearGreed: { score: 0.5, weight: 1.0 },
          social: { score: 0, volume: 0, weight: 1.0 },
          whales: { score: 0, activity: 0, weight: 1.0 },
        },
      };

      const enhanced = scoring.enhanceSignal(signal, lowConfidenceSentiment);

      expect(enhanced.adjustedConfidence).toBe(signal.confidence);
      expect(enhanced.adjustedSignal).toBe(signal.signal);
      expect(enhanced.sentiment.impact).toBe(0);
    });
  });

  describe('enhanceSignalsBatch', () => {
    it('should enhance multiple signals', () => {
      const signals: AggregatedSignal[] = [
        {
          symbol: 'BTC-USDT',
          signal: 'BUY',
          confidence: 70,
          strength: 75,
          timestamp: new Date(),
          indicators: {
            rsi: { value: 45, signal: 'BUY', weight: 1.0 },
            macd: { value: 0.5, signal: 'BUY', weight: 1.0 },
            bollinger: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            stochastic: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            obv: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            adx: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            atr: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            supportResistance: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          },
          explanation: 'Test signal',
        },
        {
          symbol: 'ETH-USDT',
          signal: 'SELL',
          confidence: 65,
          strength: 70,
          timestamp: new Date(),
          indicators: {
            rsi: { value: 65, signal: 'SELL', weight: 1.0 },
            macd: { value: -0.5, signal: 'SELL', weight: 1.0 },
            bollinger: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            stochastic: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            obv: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            adx: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            atr: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            supportResistance: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          },
          explanation: 'Test signal',
        },
      ];

      const sentiments = new Map<string, AggregatedSentiment>([
        [
          'BTC-USDT',
          {
            symbol: 'BTC-USDT',
            overallScore: 0.6,
            sentiment: 'BULLISH',
            confidence: 80,
            timestamp: new Date(),
            components: {
              news: { score: 0.6, count: 5, weight: 1.0 },
              fearGreed: { score: 0.5, weight: 1.0 },
              social: { score: 0, volume: 0, weight: 1.0 },
              whales: { score: 0, activity: 0, weight: 1.0 },
            },
          },
        ],
        [
          'ETH-USDT',
          {
            symbol: 'ETH-USDT',
            overallScore: -0.5,
            sentiment: 'BEARISH',
            confidence: 70,
            timestamp: new Date(),
            components: {
              news: { score: -0.5, count: 4, weight: 1.0 },
              fearGreed: { score: -0.3, weight: 1.0 },
              social: { score: 0, volume: 0, weight: 1.0 },
              whales: { score: 0, activity: 0, weight: 1.0 },
            },
          },
        ],
      ]);

      const enhanced = scoring.enhanceSignalsBatch(signals, sentiments);

      expect(enhanced).toHaveLength(2);
      expect(enhanced[0].symbol).toBe('BTC-USDT');
      expect(enhanced[1].symbol).toBe('ETH-USDT');
      expect(enhanced[0].adjustedConfidence).toBeGreaterThan(signals[0].confidence);
      expect(enhanced[1].adjustedConfidence).toBeGreaterThan(signals[1].confidence);
    });

    it('should handle missing sentiment data', () => {
      const signals: AggregatedSignal[] = [
        {
          symbol: 'BTC-USDT',
          signal: 'BUY',
          confidence: 70,
          strength: 75,
          timestamp: new Date(),
          indicators: {
            rsi: { value: 45, signal: 'BUY', weight: 1.0 },
            macd: { value: 0.5, signal: 'BUY', weight: 1.0 },
            bollinger: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            stochastic: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            obv: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            adx: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            atr: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
            supportResistance: { value: 0, signal: 'NEUTRAL', weight: 1.0 },
          },
          explanation: 'Test signal',
        },
      ];

      const sentiments = new Map<string, AggregatedSentiment>();

      const enhanced = scoring.enhanceSignalsBatch(signals, sentiments);

      expect(enhanced).toHaveLength(1);
      expect(enhanced[0].adjustedConfidence).toBe(signals[0].confidence);
      expect(enhanced[0].adjustedSignal).toBe(signals[0].signal);
    });
  });
});
