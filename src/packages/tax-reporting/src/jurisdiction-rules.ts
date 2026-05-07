import { Jurisdiction, JurisdictionRules } from './types.js';

/**
 * Tax jurisdiction rules and regulations
 *
 * DISCLAIMER: These rules are simplified representations and may not reflect
 * current tax laws. Always consult with a qualified tax professional.
 */

export const JURISDICTION_RULES: Record<Jurisdiction, JurisdictionRules> = {
  US: {
    jurisdiction: 'US',
    shortTermThresholdDays: 365,
    washSaleRuleDays: 30,
    allowsSpecificId: true,
    taxYearStart: { month: 1, day: 1 },
    requiresCapitalGainsReport: true,
    requiresIncomeReport: true,
  },
  UK: {
    jurisdiction: 'UK',
    shortTermThresholdDays: 0, // UK doesn't distinguish short/long term
    allowsSpecificId: true,
    taxYearStart: { month: 4, day: 6 },
    requiresCapitalGainsReport: true,
    requiresIncomeReport: true,
  },
  DE: {
    jurisdiction: 'DE',
    shortTermThresholdDays: 365,
    allowsSpecificId: false,
    taxYearStart: { month: 1, day: 1 },
    requiresCapitalGainsReport: true,
    requiresIncomeReport: true,
  },
  FR: {
    jurisdiction: 'FR',
    shortTermThresholdDays: 0,
    allowsSpecificId: false,
    taxYearStart: { month: 1, day: 1 },
    requiresCapitalGainsReport: true,
    requiresIncomeReport: true,
  },
  ES: {
    jurisdiction: 'ES',
    shortTermThresholdDays: 365,
    allowsSpecificId: false,
    taxYearStart: { month: 1, day: 1 },
    requiresCapitalGainsReport: true,
    requiresIncomeReport: true,
  },
  IT: {
    jurisdiction: 'IT',
    shortTermThresholdDays: 0,
    allowsSpecificId: false,
    taxYearStart: { month: 1, day: 1 },
    requiresCapitalGainsReport: true,
    requiresIncomeReport: true,
  },
  NL: {
    jurisdiction: 'NL',
    shortTermThresholdDays: 0,
    allowsSpecificId: false,
    taxYearStart: { month: 1, day: 1 },
    requiresCapitalGainsReport: true,
    requiresIncomeReport: false,
  },
  CA: {
    jurisdiction: 'CA',
    shortTermThresholdDays: 0,
    allowsSpecificId: true,
    taxYearStart: { month: 1, day: 1 },
    requiresCapitalGainsReport: true,
    requiresIncomeReport: true,
  },
  AU: {
    jurisdiction: 'AU',
    shortTermThresholdDays: 365,
    allowsSpecificId: true,
    taxYearStart: { month: 7, day: 1 },
    requiresCapitalGainsReport: true,
    requiresIncomeReport: true,
  },
  JP: {
    jurisdiction: 'JP',
    shortTermThresholdDays: 0,
    allowsSpecificId: false,
    taxYearStart: { month: 1, day: 1 },
    requiresCapitalGainsReport: true,
    requiresIncomeReport: true,
  },
  SG: {
    jurisdiction: 'SG',
    shortTermThresholdDays: 0,
    allowsSpecificId: false,
    taxYearStart: { month: 1, day: 1 },
    requiresCapitalGainsReport: false, // Singapore doesn't tax capital gains
    requiresIncomeReport: true,
  },
};

export function getJurisdictionRules(jurisdiction: Jurisdiction): JurisdictionRules {
  return JURISDICTION_RULES[jurisdiction];
}

export function isLongTerm(acquiredDate: Date, disposedDate: Date, jurisdiction: Jurisdiction): boolean {
  const rules = getJurisdictionRules(jurisdiction);
  const daysDiff = Math.floor((disposedDate.getTime() - acquiredDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff > rules.shortTermThresholdDays;
}

export function getTaxYearStart(year: number, jurisdiction: Jurisdiction): Date {
  const rules = getJurisdictionRules(jurisdiction);
  return new Date(year, rules.taxYearStart.month - 1, rules.taxYearStart.day);
}

export function getTaxYearEnd(year: number, jurisdiction: Jurisdiction): Date {
  const rules = getJurisdictionRules(jurisdiction);
  const nextYearStart = getTaxYearStart(year + 1, jurisdiction);
  return new Date(nextYearStart.getTime() - 1);
}
