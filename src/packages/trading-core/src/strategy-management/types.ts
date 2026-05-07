/**
 * Strategy Management Types
 * Core types for strategy CRUD, versioning, and sharing
 */

import type { BacktestResult } from "../backtesting/backtest-engine.js";

export type StrategyStatus = "draft" | "active" | "archived" | "published";
export type StrategyVisibility = "private" | "public";
export type StrategyCategory =
  | "trend-following"
  | "mean-reversion"
  | "momentum"
  | "breakout"
  | "arbitrage"
  | "scalping"
  | "swing"
  | "custom";

export interface StrategyParameter {
  name: string;
  type: "number" | "boolean" | "string" | "select";
  value: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  description?: string;
}

export interface StrategyIndicator {
  name: string;
  type: string;
  parameters: Record<string, number | string | boolean>;
}

export interface StrategyCondition {
  id: string;
  type: "if" | "and" | "or";
  operator?: ">" | "<" | ">=" | "<=" | "==" | "!=";
  left?: string;
  right?: string | number;
  conditions?: StrategyCondition[];
  action?: "buy" | "sell" | "close";
}

export interface StrategyRule {
  entry: StrategyCondition[];
  exit: StrategyCondition[];
  stopLoss?: {
    type: "percentage" | "atr" | "fixed";
    value: number;
  };
  takeProfit?: {
    type: "percentage" | "atr" | "fixed";
    value: number;
  };
}

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  description: string;
  category: StrategyCategory;
  status: StrategyStatus;
  visibility: StrategyVisibility;
  version: number;
  parentId?: string;
  tags: string[];
  parameters: StrategyParameter[];
  indicators: StrategyIndicator[];
  rules: StrategyRule;
  code?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StrategyVersion {
  id: string;
  strategyId: string;
  version: number;
  name: string;
  description: string;
  parameters: StrategyParameter[];
  indicators: StrategyIndicator[];
  rules: StrategyRule;
  code?: string;
  createdAt: Date;
  createdBy: string;
  commitMessage?: string;
}

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category: StrategyCategory;
  tags: string[];
  parameters: StrategyParameter[];
  indicators: StrategyIndicator[];
  rules: StrategyRule;
  code?: string;
  previewImage?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

export interface StrategyPerformance {
  strategyId: string;
  version: number;
  backtestResults: BacktestResult[];
  avgReturn: number;
  avgSharpe: number;
  avgWinRate: number;
  consistency: number;
  totalBacktests: number;
  lastBacktestAt?: Date;
}

export interface StrategyRating {
  id: string;
  strategyId: string;
  userId: string;
  rating: number;
  review?: string;
  createdAt: Date;
}

export interface StrategyMarketplaceListing {
  strategyId: string;
  strategy: Strategy;
  performance: StrategyPerformance;
  ratings: {
    average: number;
    count: number;
  };
  downloads: number;
  author: {
    id: string;
    username: string;
    reputation: number;
  };
  featured: boolean;
  publishedAt: Date;
}

export interface CreateStrategyInput {
  name: string;
  description: string;
  category: StrategyCategory;
  visibility?: StrategyVisibility;
  tags?: string[];
  parameters?: StrategyParameter[];
  indicators?: StrategyIndicator[];
  rules?: StrategyRule;
  code?: string;
}

export interface UpdateStrategyInput {
  name?: string;
  description?: string;
  category?: StrategyCategory;
  status?: StrategyStatus;
  visibility?: StrategyVisibility;
  tags?: string[];
  parameters?: StrategyParameter[];
  indicators?: StrategyIndicator[];
  rules?: StrategyRule;
  code?: string;
  commitMessage?: string;
}

export interface StrategyFilter {
  userId?: string;
  category?: StrategyCategory;
  status?: StrategyStatus;
  visibility?: StrategyVisibility;
  tags?: string[];
  search?: string;
  sortBy?: "createdAt" | "updatedAt" | "name" | "performance";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface StrategyExport {
  version: string;
  strategy: Omit<Strategy, "id" | "userId" | "createdAt" | "updatedAt">;
  performance?: StrategyPerformance;
  exportedAt: Date;
}

export interface StrategyImport {
  name: string;
  description: string;
  category: StrategyCategory;
  tags: string[];
  parameters: StrategyParameter[];
  indicators: StrategyIndicator[];
  rules: StrategyRule;
  code?: string;
}

export interface StrategyValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}
