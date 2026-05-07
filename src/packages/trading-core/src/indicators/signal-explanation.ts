/**
 * Signal Explanation Generator
 *
 * Generates human-readable explanations for trading signals
 * based on technical indicator analysis.
 */

import type { AggregatedSignal } from './signal-aggregator';

export interface SignalExplanation {
  summary: string;
  reasoning: string[];
  risks: string[];
  recommendations: string[];
  technicalDetails: {
    indicator: string;
    value: string;
    interpretation: string;
  }[];
}

export class SignalExplanationGenerator {
  /**
   * Generate detailed explanation for an aggregated signal
   */
  generate(signal: AggregatedSignal): SignalExplanation {
    const summary = this.generateSummary(signal);
    const reasoning = this.generateReasoning(signal);
    const risks = this.generateRisks(signal);
    const recommendations = this.generateRecommendations(signal);
    const technicalDetails = this.generateTechnicalDetails(signal);

    return {
      summary,
      reasoning,
      risks,
      recommendations,
      technicalDetails,
    };
  }

  private generateSummary(signal: AggregatedSignal): string {
    const { signal: direction, confidence, strength, symbol } = signal;

    if (direction === 'NEUTRAL') {
      return `No clear trading signal for ${symbol}. Market conditions are mixed with ${confidence.toFixed(0)}% confidence.`;
    }

    const action = direction === 'BUY' ? 'buying opportunity' : 'selling opportunity';
    const confidenceLevel = confidence >= 80 ? 'strong' : confidence >= 60 ? 'moderate' : 'weak';

    return `${confidenceLevel.toUpperCase()} ${action} detected for ${symbol} with ${confidence.toFixed(0)}% confidence and ${strength.toFixed(0)}% indicator agreement.`;
  }

  private generateReasoning(signal: AggregatedSignal): string[] {
    const reasoning: string[] = [];
    const { indicators, signal: direction } = signal;

    // RSI reasoning
    if (Math.abs(indicators.rsi.value) > 0.3) {
      const condition = indicators.rsi.signal === 'OVERBOUGHT' ? 'overbought' : 'oversold';
      reasoning.push(`RSI indicates ${condition} conditions, suggesting ${indicators.rsi.signal === 'OVERBOUGHT' ? 'potential reversal down' : 'potential reversal up'}`);
    }

    // MACD reasoning
    if (indicators.macd.signal !== 'NEUTRAL') {
      reasoning.push(`MACD shows ${indicators.macd.signal.toLowerCase()} crossover, indicating ${indicators.macd.signal === 'BULLISH' ? 'upward' : 'downward'} momentum`);
    }

    // Bollinger Bands reasoning
    if (indicators.bollinger.signal !== 'NEUTRAL') {
      reasoning.push(`Price is near ${indicators.bollinger.signal === 'OVERBOUGHT' ? 'upper' : 'lower'} Bollinger Band, suggesting ${indicators.bollinger.signal === 'OVERBOUGHT' ? 'resistance' : 'support'}`);
    }

    // Stochastic reasoning
    if (Math.abs(indicators.stochastic.value) > 0.3) {
      reasoning.push(`Stochastic oscillator confirms ${indicators.stochastic.signal.toLowerCase()} momentum`);
    }

    // OBV reasoning
    if (indicators.obv.signal !== 'NEUTRAL') {
      reasoning.push(`Volume flow is ${indicators.obv.signal === 'BULLISH' ? 'positive' : 'negative'}, showing ${indicators.obv.signal === 'BULLISH' ? 'accumulation' : 'distribution'}`);
    }

    // ADX reasoning
    if (Math.abs(indicators.adx.value) > 0.3) {
      const trendStrength = indicators.adx.weight > 1.5 ? 'strong' : indicators.adx.weight > 1 ? 'moderate' : 'weak';
      reasoning.push(`ADX shows ${trendStrength} ${indicators.adx.signal.toLowerCase()} trend`);
    }

    // Support/Resistance reasoning
    if (Math.abs(indicators.supportResistance.value) > 0.3) {
      reasoning.push(`Price is near key ${indicators.supportResistance.signal === 'BULLISH' ? 'support' : 'resistance'} level`);
    }

    if (reasoning.length === 0) {
      reasoning.push('Mixed signals from technical indicators');
    }

    return reasoning;
  }

  private generateRisks(signal: AggregatedSignal): string[] {
    const risks: string[] = [];
    const { confidence, strength, indicators } = signal;

    // Low confidence risk
    if (confidence < 70) {
      risks.push(`Moderate confidence level (${confidence.toFixed(0)}%) - signal may be unreliable`);
    }

    // Low agreement risk
    if (strength < 60) {
      risks.push(`Low indicator agreement (${strength.toFixed(0)}%) - conflicting signals present`);
    }

    // High volatility risk
    if (indicators.atr.signal === 'HIGH') {
      risks.push('High market volatility detected - wider stop losses recommended');
    }

    // Weak trend risk
    if (indicators.adx.weight < 1) {
      risks.push('Weak trend strength - market may be ranging');
    }

    // Overbought/Oversold risk
    if (indicators.rsi.signal === 'OVERBOUGHT' && signal.signal === 'BUY') {
      risks.push('RSI shows overbought conditions - potential for reversal');
    }
    if (indicators.rsi.signal === 'OVERSOLD' && signal.signal === 'SELL') {
      risks.push('RSI shows oversold conditions - potential for bounce');
    }

    // Near resistance/support risk
    if (Math.abs(indicators.supportResistance.value) > 0.5) {
      const level = indicators.supportResistance.signal === 'BULLISH' ? 'support' : 'resistance';
      risks.push(`Price near key ${level} level - watch for rejection or breakout`);
    }

    if (risks.length === 0) {
      risks.push('Standard market risks apply');
    }

    return risks;
  }

  private generateRecommendations(signal: AggregatedSignal): string[] {
    const recommendations: string[] = [];
    const { signal: direction, confidence, indicators } = signal;

    if (direction === 'NEUTRAL') {
      recommendations.push('Wait for clearer signals before entering position');
      recommendations.push('Monitor key support and resistance levels');
      return recommendations;
    }

    // Entry recommendations
    if (confidence >= 70) {
      recommendations.push(`Consider ${direction === 'BUY' ? 'long' : 'short'} position with appropriate risk management`);
    } else {
      recommendations.push(`Wait for confirmation before entering ${direction === 'BUY' ? 'long' : 'short'} position`);
    }

    // Stop loss recommendations based on ATR
    if (indicators.atr.signal === 'HIGH') {
      recommendations.push('Use wider stop loss (2-3x ATR) due to high volatility');
    } else if (indicators.atr.signal === 'LOW') {
      recommendations.push('Tighter stop loss (1-1.5x ATR) acceptable in low volatility');
    } else {
      recommendations.push('Standard stop loss (2x ATR) recommended');
    }

    // Position sizing recommendations
    if (confidence < 70 || indicators.atr.signal === 'HIGH') {
      recommendations.push('Reduce position size due to uncertainty or high volatility');
    }

    // Exit recommendations
    if (Math.abs(indicators.supportResistance.value) > 0.5) {
      const level = direction === 'BUY' ? 'resistance' : 'support';
      recommendations.push(`Consider taking profits near next ${level} level`);
    }

    // Trend following recommendations
    if (indicators.adx.weight > 1.5) {
      recommendations.push('Strong trend detected - consider trailing stop to capture extended move');
    }

    return recommendations;
  }

  private generateTechnicalDetails(signal: AggregatedSignal): SignalExplanation['technicalDetails'] {
    const details: SignalExplanation['technicalDetails'] = [];
    const { indicators } = signal;

    details.push({
      indicator: 'RSI',
      value: indicators.rsi.signal,
      interpretation: this.interpretRSI(indicators.rsi.signal),
    });

    details.push({
      indicator: 'MACD',
      value: indicators.macd.signal,
      interpretation: this.interpretMACD(indicators.macd.signal),
    });

    details.push({
      indicator: 'Bollinger Bands',
      value: indicators.bollinger.signal,
      interpretation: this.interpretBollinger(indicators.bollinger.signal),
    });

    details.push({
      indicator: 'Stochastic',
      value: indicators.stochastic.signal,
      interpretation: this.interpretStochastic(indicators.stochastic.signal),
    });

    details.push({
      indicator: 'OBV',
      value: indicators.obv.signal,
      interpretation: this.interpretOBV(indicators.obv.signal),
    });

    details.push({
      indicator: 'ADX',
      value: indicators.adx.signal,
      interpretation: this.interpretADX(indicators.adx.signal, indicators.adx.weight),
    });

    details.push({
      indicator: 'ATR',
      value: indicators.atr.signal,
      interpretation: this.interpretATR(indicators.atr.signal),
    });

    details.push({
      indicator: 'Support/Resistance',
      value: indicators.supportResistance.signal,
      interpretation: this.interpretSR(indicators.supportResistance.signal),
    });

    return details;
  }

  private interpretRSI(signal: string): string {
    if (signal === 'OVERBOUGHT') return 'Market is overbought, potential reversal down';
    if (signal === 'OVERSOLD') return 'Market is oversold, potential reversal up';
    return 'RSI in neutral zone';
  }

  private interpretMACD(signal: string): string {
    if (signal === 'BULLISH') return 'MACD line crossed above signal line, bullish momentum';
    if (signal === 'BEARISH') return 'MACD line crossed below signal line, bearish momentum';
    return 'No MACD crossover detected';
  }

  private interpretBollinger(signal: string): string {
    if (signal === 'OVERBOUGHT') return 'Price near upper band, potential resistance';
    if (signal === 'OVERSOLD') return 'Price near lower band, potential support';
    return 'Price within normal Bollinger Band range';
  }

  private interpretStochastic(signal: string): string {
    if (signal === 'BULLISH') return 'Stochastic shows bullish momentum';
    if (signal === 'BEARISH') return 'Stochastic shows bearish momentum';
    if (signal === 'OVERBOUGHT') return 'Stochastic in overbought zone';
    if (signal === 'OVERSOLD') return 'Stochastic in oversold zone';
    return 'Stochastic in neutral zone';
  }

  private interpretOBV(signal: string): string {
    if (signal === 'BULLISH') return 'Volume flow positive, accumulation phase';
    if (signal === 'BEARISH') return 'Volume flow negative, distribution phase';
    return 'Volume flow neutral';
  }

  private interpretADX(signal: string, weight: number): string {
    const strength = weight > 1.5 ? 'Strong' : weight > 1 ? 'Moderate' : 'Weak';
    if (signal === 'UP') return `${strength} uptrend detected`;
    if (signal === 'DOWN') return `${strength} downtrend detected`;
    return 'No clear trend direction';
  }

  private interpretATR(signal: string): string {
    if (signal === 'HIGH') return 'High volatility - wider stops recommended';
    if (signal === 'LOW') return 'Low volatility - tighter stops possible';
    return 'Moderate volatility';
  }

  private interpretSR(signal: string): string {
    if (signal === 'BULLISH') return 'Price near support level';
    if (signal === 'BEARISH') return 'Price near resistance level';
    return 'No nearby support/resistance';
  }
}
