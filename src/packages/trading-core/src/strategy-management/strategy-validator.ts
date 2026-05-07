/**
 * Strategy Validator
 * Validates strategy configurations and rules
 */

import type {
  Strategy,
  StrategyParameter,
  StrategyIndicator,
  StrategyRule,
  StrategyCondition,
  StrategyValidationResult,
  CreateStrategyInput,
  UpdateStrategyInput,
} from "./types.js";

export class StrategyValidator {
  private readonly VALID_INDICATORS = [
    "SMA",
    "EMA",
    "RSI",
    "MACD",
    "BB",
    "ATR",
    "STOCH",
    "ADX",
    "CCI",
    "OBV",
    "VWAP",
  ];

  private readonly VALID_OPERATORS = [">", "<", ">=", "<=", "==", "!="];

  validate(input: CreateStrategyInput | UpdateStrategyInput): StrategyValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // Validate name
    if ("name" in input && input.name !== undefined) {
      if (!input.name || input.name.trim().length === 0) {
        errors.push({ field: "name", message: "Name is required" });
      } else if (input.name.length > 100) {
        errors.push({ field: "name", message: "Name must be less than 100 characters" });
      }
    }

    // Validate description
    if ("description" in input && input.description !== undefined) {
      if (!input.description || input.description.trim().length === 0) {
        errors.push({ field: "description", message: "Description is required" });
      } else if (input.description.length > 1000) {
        errors.push({ field: "description", message: "Description must be less than 1000 characters" });
      }
    }

    // Validate parameters
    if (input.parameters) {
      const paramErrors = this.validateParameters(input.parameters);
      errors.push(...paramErrors);
    }

    // Validate indicators
    if (input.indicators) {
      const indicatorErrors = this.validateIndicators(input.indicators);
      errors.push(...indicatorErrors);

      if (input.indicators.length === 0) {
        warnings.push({ field: "indicators", message: "Strategy has no indicators" });
      }
    }

    // Validate rules
    if (input.rules) {
      const ruleErrors = this.validateRules(input.rules);
      errors.push(...ruleErrors);
    }

    // Validate code if present
    if (input.code) {
      const codeErrors = this.validateCode(input.code);
      errors.push(...codeErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateParameters(parameters: StrategyParameter[]): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];

    parameters.forEach((param, index) => {
      if (!param.name || param.name.trim().length === 0) {
        errors.push({ field: `parameters[${index}].name`, message: "Parameter name is required" });
      }

      if (!param.type || !["number", "boolean", "string", "select"].includes(param.type)) {
        errors.push({ field: `parameters[${index}].type`, message: "Invalid parameter type" });
      }

      if (param.type === "number") {
        if (typeof param.value !== "number") {
          errors.push({ field: `parameters[${index}].value`, message: "Value must be a number" });
        }

        if (param.min !== undefined && param.max !== undefined && param.min >= param.max) {
          errors.push({ field: `parameters[${index}]`, message: "Min must be less than max" });
        }

        if (param.min !== undefined && typeof param.value === "number" && param.value < param.min) {
          errors.push({ field: `parameters[${index}].value`, message: "Value is below minimum" });
        }

        if (param.max !== undefined && typeof param.value === "number" && param.value > param.max) {
          errors.push({ field: `parameters[${index}].value`, message: "Value is above maximum" });
        }
      }

      if (param.type === "select" && (!param.options || param.options.length === 0)) {
        errors.push({ field: `parameters[${index}].options`, message: "Select type requires options" });
      }

      if (param.type === "select" && param.options && !param.options.includes(String(param.value))) {
        errors.push({ field: `parameters[${index}].value`, message: "Value must be one of the options" });
      }
    });

    return errors;
  }

  private validateIndicators(indicators: StrategyIndicator[]): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];

    indicators.forEach((indicator, index) => {
      if (!indicator.name || indicator.name.trim().length === 0) {
        errors.push({ field: `indicators[${index}].name`, message: "Indicator name is required" });
      }

      if (!indicator.type || !this.VALID_INDICATORS.includes(indicator.type)) {
        errors.push({
          field: `indicators[${index}].type`,
          message: `Invalid indicator type. Must be one of: ${this.VALID_INDICATORS.join(", ")}`,
        });
      }

      // Validate indicator-specific parameters
      const paramErrors = this.validateIndicatorParameters(indicator, index);
      errors.push(...paramErrors);
    });

    return errors;
  }

  private validateIndicatorParameters(
    indicator: StrategyIndicator,
    index: number
  ): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];

    switch (indicator.type) {
      case "SMA":
      case "EMA":
        if (!indicator.parameters.period || typeof indicator.parameters.period !== "number") {
          errors.push({ field: `indicators[${index}].parameters.period`, message: "Period is required and must be a number" });
        } else if (indicator.parameters.period < 1) {
          errors.push({ field: `indicators[${index}].parameters.period`, message: "Period must be at least 1" });
        }
        break;

      case "RSI":
        if (!indicator.parameters.period || typeof indicator.parameters.period !== "number") {
          errors.push({ field: `indicators[${index}].parameters.period`, message: "Period is required and must be a number" });
        } else if (indicator.parameters.period < 2) {
          errors.push({ field: `indicators[${index}].parameters.period`, message: "RSI period must be at least 2" });
        }
        break;

      case "MACD":
        if (!indicator.parameters.fastPeriod || typeof indicator.parameters.fastPeriod !== "number") {
          errors.push({ field: `indicators[${index}].parameters.fastPeriod`, message: "Fast period is required" });
        }
        if (!indicator.parameters.slowPeriod || typeof indicator.parameters.slowPeriod !== "number") {
          errors.push({ field: `indicators[${index}].parameters.slowPeriod`, message: "Slow period is required" });
        }
        if (!indicator.parameters.signalPeriod || typeof indicator.parameters.signalPeriod !== "number") {
          errors.push({ field: `indicators[${index}].parameters.signalPeriod`, message: "Signal period is required" });
        }
        break;

      case "BB":
        if (!indicator.parameters.period || typeof indicator.parameters.period !== "number") {
          errors.push({ field: `indicators[${index}].parameters.period`, message: "Period is required" });
        }
        if (!indicator.parameters.stdDev || typeof indicator.parameters.stdDev !== "number") {
          errors.push({ field: `indicators[${index}].parameters.stdDev`, message: "Standard deviation is required" });
        }
        break;

      case "STOCH":
        if (!indicator.parameters.kPeriod || typeof indicator.parameters.kPeriod !== "number") {
          errors.push({ field: `indicators[${index}].parameters.kPeriod`, message: "K period is required" });
        }
        if (!indicator.parameters.dPeriod || typeof indicator.parameters.dPeriod !== "number") {
          errors.push({ field: `indicators[${index}].parameters.dPeriod`, message: "D period is required" });
        }
        break;
    }

    return errors;
  }

  private validateRules(rules: StrategyRule): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];

    // Validate entry conditions
    if (!rules.entry || rules.entry.length === 0) {
      errors.push({ field: "rules.entry", message: "At least one entry condition is required" });
    } else {
      rules.entry.forEach((condition, index) => {
        const conditionErrors = this.validateCondition(condition, `rules.entry[${index}]`);
        errors.push(...conditionErrors);
      });
    }

    // Validate exit conditions
    if (!rules.exit || rules.exit.length === 0) {
      errors.push({ field: "rules.exit", message: "At least one exit condition is required" });
    } else {
      rules.exit.forEach((condition, index) => {
        const conditionErrors = this.validateCondition(condition, `rules.exit[${index}]`);
        errors.push(...conditionErrors);
      });
    }

    // Validate stop loss
    if (rules.stopLoss) {
      if (!["percentage", "atr", "fixed"].includes(rules.stopLoss.type)) {
        errors.push({ field: "rules.stopLoss.type", message: "Invalid stop loss type" });
      }
      if (typeof rules.stopLoss.value !== "number" || rules.stopLoss.value <= 0) {
        errors.push({ field: "rules.stopLoss.value", message: "Stop loss value must be a positive number" });
      }
    }

    // Validate take profit
    if (rules.takeProfit) {
      if (!["percentage", "atr", "fixed"].includes(rules.takeProfit.type)) {
        errors.push({ field: "rules.takeProfit.type", message: "Invalid take profit type" });
      }
      if (typeof rules.takeProfit.value !== "number" || rules.takeProfit.value <= 0) {
        errors.push({ field: "rules.takeProfit.value", message: "Take profit value must be a positive number" });
      }
    }

    return errors;
  }

  private validateCondition(condition: StrategyCondition, path: string): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];

    if (!condition.type || !["if", "and", "or"].includes(condition.type)) {
      errors.push({ field: `${path}.type`, message: "Invalid condition type" });
    }

    if (condition.type === "if") {
      if (!condition.operator || !this.VALID_OPERATORS.includes(condition.operator)) {
        errors.push({
          field: `${path}.operator`,
          message: `Invalid operator. Must be one of: ${this.VALID_OPERATORS.join(", ")}`,
        });
      }

      if (!condition.left) {
        errors.push({ field: `${path}.left`, message: "Left operand is required" });
      }

      if (condition.right === undefined || condition.right === null) {
        errors.push({ field: `${path}.right`, message: "Right operand is required" });
      }

      if (condition.action && !["buy", "sell", "close"].includes(condition.action)) {
        errors.push({ field: `${path}.action`, message: "Invalid action" });
      }
    }

    if ((condition.type === "and" || condition.type === "or") && condition.conditions) {
      if (condition.conditions.length < 2) {
        errors.push({ field: `${path}.conditions`, message: `${condition.type.toUpperCase()} requires at least 2 conditions` });
      }

      condition.conditions.forEach((subCondition, index) => {
        const subErrors = this.validateCondition(subCondition, `${path}.conditions[${index}]`);
        errors.push(...subErrors);
      });
    }

    return errors;
  }

  private validateCode(code: string): Array<{ field: string; message: string }> {
    const errors: Array<{ field: string; message: string }> = [];

    if (code.length > 50000) {
      errors.push({ field: "code", message: "Code must be less than 50000 characters" });
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/,
      /import\s+.*\s+from/,
      /eval\s*\(/,
      /Function\s*\(/,
      /process\./,
      /child_process/,
      /fs\./,
      /\.exec\(/,
    ];

    dangerousPatterns.forEach((pattern) => {
      if (pattern.test(code)) {
        errors.push({ field: "code", message: `Code contains potentially dangerous pattern: ${pattern.source}` });
      }
    });

    // Check for required function signature
    if (!code.includes("function") && !code.includes("=>")) {
      errors.push({ field: "code", message: "Code must contain a function" });
    }

    return errors;
  }

  validateForBacktest(strategy: Strategy): StrategyValidationResult {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    if (strategy.indicators.length === 0) {
      errors.push({ field: "indicators", message: "Strategy must have at least one indicator for backtesting" });
    }

    if (strategy.rules.entry.length === 0) {
      errors.push({ field: "rules.entry", message: "Strategy must have entry rules for backtesting" });
    }

    if (strategy.rules.exit.length === 0) {
      errors.push({ field: "rules.exit", message: "Strategy must have exit rules for backtesting" });
    }

    if (!strategy.rules.stopLoss) {
      warnings.push({ field: "rules.stopLoss", message: "Strategy has no stop loss defined" });
    }

    if (!strategy.rules.takeProfit) {
      warnings.push({ field: "rules.takeProfit", message: "Strategy has no take profit defined" });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
