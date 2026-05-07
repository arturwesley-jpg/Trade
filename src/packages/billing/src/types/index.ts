export type SubscriptionTierName = 'free' | 'pro' | 'enterprise';
export type BillingInterval = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'unpaid';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface SubscriptionFeatures {
  maxAlerts: number;
  maxPositions: number;
  apiRateLimit: number;
  advancedIndicators: boolean;
  whaleTracking: boolean;
  mlPredictions: boolean;
  prioritySupport: boolean;
  customWebhooks: boolean;
  backtesting: boolean;
  portfolioAnalytics: boolean;
}

export interface SubscriptionTier {
  id: string;
  name: SubscriptionTierName;
  displayName: string;
  description: string;
  price: number;
  interval: BillingInterval;
  stripePriceId: string;
  stripeProductId: string;
  features: SubscriptionFeatures;
  trialDays: number;
  popular?: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  tierId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  type: 'card' | 'bank_account';
  last4: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  createdAt: Date;
}

export interface Invoice {
  id: string;
  userId: string;
  subscriptionId: string;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  invoiceNumber: string;
  invoicePdf?: string;
  hostedInvoiceUrl?: string;
  periodStart: Date;
  periodEnd: Date;
  paidAt?: Date;
  createdAt: Date;
}

export interface UsageRecord {
  id: string;
  userId: string;
  subscriptionId: string;
  metricType: 'api_calls' | 'alerts' | 'positions' | 'backtests';
  quantity: number;
  timestamp: Date;
  periodStart: Date;
  periodEnd: Date;
}

export interface UsageLimit {
  userId: string;
  tierId: string;
  apiCalls: number;
  alerts: number;
  positions: number;
  backtests: number;
  resetAt: Date;
}

export interface DiscountCode {
  id: string;
  code: string;
  stripeCouponId: string;
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration: 'once' | 'repeating' | 'forever';
  durationInMonths?: number;
  maxRedemptions?: number;
  redemptionsCount: number;
  active: boolean;
  expiresAt?: Date;
  createdAt: Date;
}

export interface ReferralCredit {
  id: string;
  userId: string;
  referredUserId: string;
  amount: number;
  currency: string;
  applied: boolean;
  appliedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export interface BillingMetrics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  churnRate: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  canceledSubscriptions: number;
  averageRevenuePerUser: number;
  lifetimeValue: number;
  conversionRate: number;
}

export interface SubscriptionChange {
  fromTierId: string;
  toTierId: string;
  prorated: boolean;
  proratedAmount?: number;
  effectiveDate: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  stripeEventId: string;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  retryCount: number;
  createdAt: Date;
}
