/**
 * Strategy Templates Library
 * Pre-built strategy templates for common trading strategies
 */

import type { StrategyTemplate } from "./types.js";

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: "ma-crossover",
    name: "Moving Average Crossover",
    description: "Classic trend-following strategy using two moving averages. Buy when fast MA crosses above slow MA, sell when it crosses below.",
    category: "trend-following",
    tags: ["beginner", "trend", "moving-average"],
    difficulty: "beginner",
    parameters: [
      {
        name: "fastPeriod",
        type: "number",
        value: 10,
        min: 5,
        max: 50,
        step: 1,
        description: "Fast moving average period",
      },
      {
        name: "slowPeriod",
        type: "number",
        value: 30,
        min: 20,
        max: 200,
        step: 1,
        description: "Slow moving average period",
      },
      {
        name: "maType",
        type: "select",
        value: "EMA",
        options: ["SMA", "EMA"],
        description: "Type of moving average",
      },
    ],
    indicators: [
      {
        name: "fastMA",
        type: "EMA",
        parameters: { period: 10 },
      },
      {
        name: "slowMA",
        type: "EMA",
        parameters: { period: 30 },
      },
    ],
    rules: {
      entry: [
        {
          id: "entry-1",
          type: "if",
          operator: ">",
          left: "fastMA",
          right: "slowMA",
          action: "buy",
        },
      ],
      exit: [
        {
          id: "exit-1",
          type: "if",
          operator: "<",
          left: "fastMA",
          right: "slowMA",
          action: "sell",
        },
      ],
      stopLoss: {
        type: "percentage",
        value: 2,
      },
      takeProfit: {
        type: "percentage",
        value: 4,
      },
    },
  },
  {
    id: "rsi-oversold-overbought",
    name: "RSI Oversold/Overbought",
    description: "Mean reversion strategy using RSI. Buy when oversold (RSI < 30), sell when overbought (RSI > 70).",
    category: "mean-reversion",
    tags: ["beginner", "rsi", "mean-reversion"],
    difficulty: "beginner",
    parameters: [
      {
        name: "rsiPeriod",
        type: "number",
        value: 14,
        min: 7,
        max: 28,
        step: 1,
        description: "RSI calculation period",
      },
      {
        name: "oversoldLevel",
        type: "number",
        value: 30,
        min: 20,
        max: 40,
        step: 1,
        description: "Oversold threshold",
      },
      {
        name: "overboughtLevel",
        type: "number",
        value: 70,
        min: 60,
        max: 80,
        step: 1,
        description: "Overbought threshold",
      },
    ],
    indicators: [
      {
        name: "rsi",
        type: "RSI",
        parameters: { period: 14 },
      },
    ],
    rules: {
      entry: [
        {
          id: "entry-1",
          type: "if",
          operator: "<",
          left: "rsi",
          right: 30,
          action: "buy",
        },
      ],
      exit: [
        {
          id: "exit-1",
          type: "if",
          operator: ">",
          left: "rsi",
          right: 70,
          action: "sell",
        },
      ],
      stopLoss: {
        type: "percentage",
        value: 3,
      },
      takeProfit: {
        type: "percentage",
        value: 5,
      },
    },
  },
  {
    id: "bollinger-bands-breakout",
    name: "Bollinger Bands Breakout",
    description: "Breakout strategy using Bollinger Bands. Buy when price breaks above upper band, sell when it breaks below lower band.",
    category: "breakout",
    tags: ["intermediate", "bollinger-bands", "breakout", "volatility"],
    difficulty: "intermediate",
    parameters: [
      {
        name: "bbPeriod",
        type: "number",
        value: 20,
        min: 10,
        max: 50,
        step: 1,
        description: "Bollinger Bands period",
      },
      {
        name: "bbStdDev",
        type: "number",
        value: 2,
        min: 1,
        max: 3,
        step: 0.1,
        description: "Standard deviation multiplier",
      },
    ],
    indicators: [
      {
        name: "bb",
        type: "BB",
        parameters: { period: 20, stdDev: 2 },
      },
    ],
    rules: {
      entry: [
        {
          id: "entry-1",
          type: "if",
          operator: ">",
          left: "close",
          right: "bb.upper",
          action: "buy",
        },
      ],
      exit: [
        {
          id: "exit-1",
          type: "if",
          operator: "<",
          left: "close",
          right: "bb.lower",
          action: "sell",
        },
      ],
      stopLoss: {
        type: "atr",
        value: 2,
      },
      takeProfit: {
        type: "atr",
        value: 3,
      },
    },
  },
  {
    id: "macd-divergence",
    name: "MACD Divergence",
    description: "Momentum strategy using MACD crossovers. Buy when MACD crosses above signal line, sell when it crosses below.",
    category: "momentum",
    tags: ["intermediate", "macd", "momentum", "divergence"],
    difficulty: "intermediate",
    parameters: [
      {
        name: "fastPeriod",
        type: "number",
        value: 12,
        min: 8,
        max: 20,
        step: 1,
        description: "MACD fast period",
      },
      {
        name: "slowPeriod",
        type: "number",
        value: 26,
        min: 20,
        max: 40,
        step: 1,
        description: "MACD slow period",
      },
      {
        name: "signalPeriod",
        type: "number",
        value: 9,
        min: 5,
        max: 15,
        step: 1,
        description: "MACD signal period",
      },
    ],
    indicators: [
      {
        name: "macd",
        type: "MACD",
        parameters: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
      },
    ],
    rules: {
      entry: [
        {
          id: "entry-1",
          type: "if",
          operator: ">",
          left: "macd.macd",
          right: "macd.signal",
          action: "buy",
        },
      ],
      exit: [
        {
          id: "exit-1",
          type: "if",
          operator: "<",
          left: "macd.macd",
          right: "macd.signal",
          action: "sell",
        },
      ],
      stopLoss: {
        type: "percentage",
        value: 2.5,
      },
      takeProfit: {
        type: "percentage",
        value: 5,
      },
    },
  },
  {
    id: "mean-reversion-bb-rsi",
    name: "Mean Reversion (BB + RSI)",
    description: "Advanced mean reversion combining Bollinger Bands and RSI. Buy when price touches lower band AND RSI is oversold.",
    category: "mean-reversion",
    tags: ["advanced", "bollinger-bands", "rsi", "mean-reversion", "multi-indicator"],
    difficulty: "advanced",
    parameters: [
      {
        name: "bbPeriod",
        type: "number",
        value: 20,
        min: 10,
        max: 50,
        step: 1,
        description: "Bollinger Bands period",
      },
      {
        name: "bbStdDev",
        type: "number",
        value: 2,
        min: 1,
        max: 3,
        step: 0.1,
        description: "Standard deviation multiplier",
      },
      {
        name: "rsiPeriod",
        type: "number",
        value: 14,
        min: 7,
        max: 28,
        step: 1,
        description: "RSI period",
      },
      {
        name: "oversoldLevel",
        type: "number",
        value: 30,
        min: 20,
        max: 40,
        step: 1,
        description: "RSI oversold level",
      },
      {
        name: "overboughtLevel",
        type: "number",
        value: 70,
        min: 60,
        max: 80,
        step: 1,
        description: "RSI overbought level",
      },
    ],
    indicators: [
      {
        name: "bb",
        type: "BB",
        parameters: { period: 20, stdDev: 2 },
      },
      {
        name: "rsi",
        type: "RSI",
        parameters: { period: 14 },
      },
    ],
    rules: {
      entry: [
        {
          id: "entry-1",
          type: "and",
          conditions: [
            {
              id: "entry-1-1",
              type: "if",
              operator: "<=",
              left: "close",
              right: "bb.lower",
            },
            {
              id: "entry-1-2",
              type: "if",
              operator: "<",
              left: "rsi",
              right: 30,
            },
          ],
          action: "buy",
        },
      ],
      exit: [
        {
          id: "exit-1",
          type: "or",
          conditions: [
            {
              id: "exit-1-1",
              type: "if",
              operator: ">=",
              left: "close",
              right: "bb.upper",
            },
            {
              id: "exit-1-2",
              type: "if",
              operator: ">",
              left: "rsi",
              right: 70,
            },
          ],
          action: "sell",
        },
      ],
      stopLoss: {
        type: "atr",
        value: 2,
      },
      takeProfit: {
        type: "atr",
        value: 4,
      },
    },
  },
  {
    id: "momentum-trading",
    name: "Momentum Trading",
    description: "Momentum strategy using RSI and moving averages. Buy when RSI > 50 and price is above MA.",
    category: "momentum",
    tags: ["intermediate", "momentum", "rsi", "moving-average"],
    difficulty: "intermediate",
    parameters: [
      {
        name: "rsiPeriod",
        type: "number",
        value: 14,
        min: 7,
        max: 28,
        step: 1,
        description: "RSI period",
      },
      {
        name: "maPeriod",
        type: "number",
        value: 50,
        min: 20,
        max: 200,
        step: 1,
        description: "Moving average period",
      },
      {
        name: "momentumThreshold",
        type: "number",
        value: 50,
        min: 40,
        max: 60,
        step: 1,
        description: "RSI momentum threshold",
      },
    ],
    indicators: [
      {
        name: "rsi",
        type: "RSI",
        parameters: { period: 14 },
      },
      {
        name: "ma",
        type: "EMA",
        parameters: { period: 50 },
      },
    ],
    rules: {
      entry: [
        {
          id: "entry-1",
          type: "and",
          conditions: [
            {
              id: "entry-1-1",
              type: "if",
              operator: ">",
              left: "rsi",
              right: 50,
            },
            {
              id: "entry-1-2",
              type: "if",
              operator: ">",
              left: "close",
              right: "ma",
            },
          ],
          action: "buy",
        },
      ],
      exit: [
        {
          id: "exit-1",
          type: "or",
          conditions: [
            {
              id: "exit-1-1",
              type: "if",
              operator: "<",
              left: "rsi",
              right: 50,
            },
            {
              id: "exit-1-2",
              type: "if",
              operator: "<",
              left: "close",
              right: "ma",
            },
          ],
          action: "sell",
        },
      ],
      stopLoss: {
        type: "percentage",
        value: 3,
      },
      takeProfit: {
        type: "percentage",
        value: 6,
      },
    },
  },
];

export class StrategyTemplateLibrary {
  getAll(): StrategyTemplate[] {
    return STRATEGY_TEMPLATES;
  }

  getById(id: string): StrategyTemplate | undefined {
    return STRATEGY_TEMPLATES.find((template) => template.id === id);
  }

  getByCategory(category: string): StrategyTemplate[] {
    return STRATEGY_TEMPLATES.filter((template) => template.category === category);
  }

  getByDifficulty(difficulty: "beginner" | "intermediate" | "advanced"): StrategyTemplate[] {
    return STRATEGY_TEMPLATES.filter((template) => template.difficulty === difficulty);
  }

  getByTags(tags: string[]): StrategyTemplate[] {
    return STRATEGY_TEMPLATES.filter((template) =>
      tags.some((tag) => template.tags.includes(tag))
    );
  }

  search(query: string): StrategyTemplate[] {
    const lowerQuery = query.toLowerCase();
    return STRATEGY_TEMPLATES.filter(
      (template) =>
        template.name.toLowerCase().includes(lowerQuery) ||
        template.description.toLowerCase().includes(lowerQuery) ||
        template.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }
}
