import { SubscriptionTier } from './index.js';

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTier> = {
  FREE_MONTHLY: {
    id: 'free_monthly',
    name: 'free',
    displayName: 'Free',
    description: 'Perfect for getting started with crypto trading',
    price: 0,
    interval: 'monthly',
    stripePriceId: '', // No Stripe price for free tier
    stripeProductId: '',
    trialDays: 0,
    features: {
      maxAlerts: 5,
      maxPositions: 3,
      apiRateLimit: 100, // requests per hour
      advancedIndicators: false,
      whaleTracking: false,
      mlPredictions: false,
      prioritySupport: false,
      customWebhooks: false,
      backtesting: false,
      portfolioAnalytics: false,
    },
  },
  PRO_MONTHLY: {
    id: 'pro_monthly',
    name: 'pro',
    displayName: 'Pro',
    description: 'Advanced features for serious traders',
    price: 29.99,
    interval: 'monthly',
    stripePriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',
    stripeProductId: process.env.STRIPE_PRO_PRODUCT_ID || '',
    trialDays: 14,
    popular: true,
    features: {
      maxAlerts: 50,
      maxPositions: 20,
      apiRateLimit: 1000,
      advancedIndicators: true,
      whaleTracking: true,
      mlPredictions: true,
      prioritySupport: false,
      customWebhooks: true,
      backtesting: true,
      portfolioAnalytics: true,
    },
  },
  PRO_YEARLY: {
    id: 'pro_yearly',
    name: 'pro',
    displayName: 'Pro (Annual)',
    description: 'Advanced features for serious traders - Save 20%',
    price: 287.88, // $23.99/month billed annually
    interval: 'yearly',
    stripePriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID || '',
    stripeProductId: process.env.STRIPE_PRO_PRODUCT_ID || '',
    trialDays: 14,
    features: {
      maxAlerts: 50,
      maxPositions: 20,
      apiRateLimit: 1000,
      advancedIndicators: true,
      whaleTracking: true,
      mlPredictions: true,
      prioritySupport: false,
      customWebhooks: true,
      backtesting: true,
      portfolioAnalytics: true,
    },
  },
  ENTERPRISE_MONTHLY: {
    id: 'enterprise_monthly',
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Unlimited features for professional trading teams',
    price: 99.99,
    interval: 'monthly',
    stripePriceId: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || '',
    stripeProductId: process.env.STRIPE_ENTERPRISE_PRODUCT_ID || '',
    trialDays: 30,
    features: {
      maxAlerts: -1, // unlimited
      maxPositions: -1, // unlimited
      apiRateLimit: 10000,
      advancedIndicators: true,
      whaleTracking: true,
      mlPredictions: true,
      prioritySupport: true,
      customWebhooks: true,
      backtesting: true,
      portfolioAnalytics: true,
    },
  },
  ENTERPRISE_YEARLY: {
    id: 'enterprise_yearly',
    name: 'enterprise',
    displayName: 'Enterprise (Annual)',
    description: 'Unlimited features for professional trading teams - Save 20%',
    price: 959.88, // $79.99/month billed annually
    interval: 'yearly',
    stripePriceId: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || '',
    stripeProductId: process.env.STRIPE_ENTERPRISE_PRODUCT_ID || '',
    trialDays: 30,
    features: {
      maxAlerts: -1, // unlimited
      maxPositions: -1, // unlimited
      apiRateLimit: 10000,
      advancedIndicators: true,
      whaleTracking: true,
      mlPredictions: true,
      prioritySupport: true,
      customWebhooks: true,
      backtesting: true,
      portfolioAnalytics: true,
    },
  },
};

export function getTierById(tierId: string): SubscriptionTier | undefined {
  return SUBSCRIPTION_TIERS[tierId];
}

export function getTiersByName(name: string): SubscriptionTier[] {
  return Object.values(SUBSCRIPTION_TIERS).filter(tier => tier.name === name);
}

export function getAllTiers(): SubscriptionTier[] {
  return Object.values(SUBSCRIPTION_TIERS);
}

export function isFeatureAvailable(tier: SubscriptionTier, feature: keyof SubscriptionTier['features']): boolean {
  return tier.features[feature] === true || (typeof tier.features[feature] === 'number' && tier.features[feature] !== 0);
}

export function canUpgrade(currentTierId: string, targetTierId: string): boolean {
  const current = getTierById(currentTierId);
  const target = getTierById(targetTierId);

  if (!current || !target) return false;

  const tierOrder = { free: 0, pro: 1, enterprise: 2 };
  return tierOrder[target.name] > tierOrder[current.name];
}

export function canDowngrade(currentTierId: string, targetTierId: string): boolean {
  const current = getTierById(currentTierId);
  const target = getTierById(targetTierId);

  if (!current || !target) return false;

  const tierOrder = { free: 0, pro: 1, enterprise: 2 };
  return tierOrder[target.name] < tierOrder[current.name];
}
