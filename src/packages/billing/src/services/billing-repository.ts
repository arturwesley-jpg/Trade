import { Pool } from 'pg';
import { logger } from '@trade/shared/logger';
import type {
  Subscription,
  PaymentMethod,
  Invoice,
  UsageRecord,
  UsageLimit,
  DiscountCode,
  ReferralCredit,
  SubscriptionStatus,
} from '../types/index.js';
import { getTierById } from '../types/subscription-tiers.js';

export class BillingRepository {
  constructor(private pool: Pool) {}

  async createSubscription(subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription> {
    const query = `
      INSERT INTO subscriptions (
        user_id, tier_id, stripe_subscription_id, stripe_customer_id,
        status, current_period_start, current_period_end, cancel_at_period_end,
        canceled_at, trial_start, trial_end
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      subscription.userId,
      subscription.tierId,
      subscription.stripeSubscriptionId,
      subscription.stripeCustomerId,
      subscription.status,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      subscription.cancelAtPeriodEnd,
      subscription.canceledAt || null,
      subscription.trialStart || null,
      subscription.trialEnd || null,
    ];

    try {
      const result = await this.pool.query(query, values);
      return this.mapSubscription(result.rows[0]);
    } catch (error) {
      logger.error({ error, subscription }, 'Failed to create subscription');
      throw new Error('Failed to create subscription');
    }
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    const query = 'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1';

    try {
      const result = await this.pool.query(query, [userId]);
      return result.rows[0] ? this.mapSubscription(result.rows[0]) : null;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get subscription by user ID');
      throw new Error('Failed to get subscription');
    }
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const query = 'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1';

    try {
      const result = await this.pool.query(query, [stripeSubscriptionId]);
      return result.rows[0] ? this.mapSubscription(result.rows[0]) : null;
    } catch (error) {
      logger.error({ error, stripeSubscriptionId }, 'Failed to get subscription by Stripe ID');
      throw new Error('Failed to get subscription');
    }
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && value !== undefined) {
        fields.push(`${this.camelToSnake(key)} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE subscriptions
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, values);
      if (result.rows.length === 0) {
        throw new Error('Subscription not found');
      }
      return this.mapSubscription(result.rows[0]);
    } catch (error) {
      logger.error({ error, id, updates }, 'Failed to update subscription');
      throw new Error('Failed to update subscription');
    }
  }

  async addPaymentMethod(paymentMethod: Omit<PaymentMethod, 'id' | 'createdAt'>): Promise<PaymentMethod> {
    const query = `
      INSERT INTO payment_methods (
        user_id, stripe_payment_method_id, type, last4, brand,
        expiry_month, expiry_year, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      paymentMethod.userId,
      paymentMethod.stripePaymentMethodId,
      paymentMethod.type,
      paymentMethod.last4,
      paymentMethod.brand || null,
      paymentMethod.expiryMonth || null,
      paymentMethod.expiryYear || null,
      paymentMethod.isDefault,
    ];

    try {
      const result = await this.pool.query(query, values);
      return this.mapPaymentMethod(result.rows[0]);
    } catch (error) {
      logger.error({ error, paymentMethod }, 'Failed to add payment method');
      throw new Error('Failed to add payment method');
    }
  }

  async getPaymentMethodsByUserId(userId: string): Promise<PaymentMethod[]> {
    const query = 'SELECT * FROM payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC';

    try {
      const result = await this.pool.query(query, [userId]);
      return result.rows.map(row => this.mapPaymentMethod(row));
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get payment methods');
      throw new Error('Failed to get payment methods');
    }
  }

  async removePaymentMethod(id: string): Promise<void> {
    const query = 'DELETE FROM payment_methods WHERE id = $1';

    try {
      await this.pool.query(query, [id]);
    } catch (error) {
      logger.error({ error, id }, 'Failed to remove payment method');
      throw new Error('Failed to remove payment method');
    }
  }

  async createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'>): Promise<Invoice> {
    const query = `
      INSERT INTO invoices (
        user_id, subscription_id, stripe_invoice_id, amount, currency,
        status, invoice_number, invoice_pdf, hosted_invoice_url,
        period_start, period_end, paid_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      invoice.userId,
      invoice.subscriptionId,
      invoice.stripeInvoiceId,
      invoice.amount,
      invoice.currency,
      invoice.status,
      invoice.invoiceNumber,
      invoice.invoicePdf || null,
      invoice.hostedInvoiceUrl || null,
      invoice.periodStart,
      invoice.periodEnd,
      invoice.paidAt || null,
    ];

    try {
      const result = await this.pool.query(query, values);
      return this.mapInvoice(result.rows[0]);
    } catch (error) {
      logger.error({ error, invoice }, 'Failed to create invoice');
      throw new Error('Failed to create invoice');
    }
  }

  async getInvoicesByUserId(userId: string, limit: number = 10): Promise<Invoice[]> {
    const query = 'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2';

    try {
      const result = await this.pool.query(query, [userId, limit]);
      return result.rows.map(row => this.mapInvoice(row));
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get invoices');
      throw new Error('Failed to get invoices');
    }
  }

  async recordUsage(usage: Omit<UsageRecord, 'id'>): Promise<UsageRecord> {
    const query = `
      INSERT INTO usage_records (
        user_id, subscription_id, metric_type, quantity, timestamp,
        period_start, period_end
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      usage.userId,
      usage.subscriptionId,
      usage.metricType,
      usage.quantity,
      usage.timestamp,
      usage.periodStart,
      usage.periodEnd,
    ];

    try {
      const result = await this.pool.query(query, values);
      return this.mapUsageRecord(result.rows[0]);
    } catch (error) {
      logger.error({ error, usage }, 'Failed to record usage');
      throw new Error('Failed to record usage');
    }
  }

  async getUsageByPeriod(userId: string, periodStart: Date, periodEnd: Date): Promise<UsageRecord[]> {
    const query = `
      SELECT * FROM usage_records
      WHERE user_id = $1 AND timestamp >= $2 AND timestamp < $3
      ORDER BY timestamp DESC
    `;

    try {
      const result = await this.pool.query(query, [userId, periodStart, periodEnd]);
      return result.rows.map(row => this.mapUsageRecord(row));
    } catch (error) {
      logger.error({ error, userId, periodStart, periodEnd }, 'Failed to get usage');
      throw new Error('Failed to get usage');
    }
  }

  async getUsageLimits(userId: string): Promise<UsageLimit | null> {
    const query = 'SELECT * FROM usage_limits WHERE user_id = $1';

    try {
      const result = await this.pool.query(query, [userId]);
      return result.rows[0] ? this.mapUsageLimit(result.rows[0]) : null;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get usage limits');
      throw new Error('Failed to get usage limits');
    }
  }

  async updateUsageLimits(userId: string, limits: Partial<UsageLimit>): Promise<UsageLimit> {
    const query = `
      INSERT INTO usage_limits (user_id, tier_id, api_calls, alerts, positions, backtests, reset_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id)
      DO UPDATE SET
        tier_id = EXCLUDED.tier_id,
        api_calls = EXCLUDED.api_calls,
        alerts = EXCLUDED.alerts,
        positions = EXCLUDED.positions,
        backtests = EXCLUDED.backtests,
        reset_at = EXCLUDED.reset_at
      RETURNING *
    `;

    const values = [
      userId,
      limits.tierId,
      limits.apiCalls || 0,
      limits.alerts || 0,
      limits.positions || 0,
      limits.backtests || 0,
      limits.resetAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ];

    try {
      const result = await this.pool.query(query, values);
      return this.mapUsageLimit(result.rows[0]);
    } catch (error) {
      logger.error({ error, userId, limits }, 'Failed to update usage limits');
      throw new Error('Failed to update usage limits');
    }
  }

  async incrementUsage(userId: string, metricType: string, amount: number = 1): Promise<void> {
    const query = `
      UPDATE usage_limits
      SET ${metricType} = ${metricType} + $1
      WHERE user_id = $2
    `;

    try {
      await this.pool.query(query, [amount, userId]);
    } catch (error) {
      logger.error({ error, userId, metricType, amount }, 'Failed to increment usage');
      throw new Error('Failed to increment usage');
    }
  }

  async createDiscountCode(code: Omit<DiscountCode, 'id' | 'createdAt'>): Promise<DiscountCode> {
    const query = `
      INSERT INTO discount_codes (
        code, stripe_coupon_id, percent_off, amount_off, currency,
        duration, duration_in_months, max_redemptions, redemptions_count,
        active, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      code.code,
      code.stripeCouponId,
      code.percentOff || null,
      code.amountOff || null,
      code.currency || null,
      code.duration,
      code.durationInMonths || null,
      code.maxRedemptions || null,
      code.redemptionsCount,
      code.active,
      code.expiresAt || null,
    ];

    try {
      const result = await this.pool.query(query, values);
      return this.mapDiscountCode(result.rows[0]);
    } catch (error) {
      logger.error({ error, code }, 'Failed to create discount code');
      throw new Error('Failed to create discount code');
    }
  }

  async getDiscountCodeByCode(code: string): Promise<DiscountCode | null> {
    const query = 'SELECT * FROM discount_codes WHERE code = $1 AND active = true';

    try {
      const result = await this.pool.query(query, [code]);
      return result.rows[0] ? this.mapDiscountCode(result.rows[0]) : null;
    } catch (error) {
      logger.error({ error, code }, 'Failed to get discount code');
      throw new Error('Failed to get discount code');
    }
  }

  async incrementDiscountRedemptions(id: string): Promise<void> {
    const query = 'UPDATE discount_codes SET redemptions_count = redemptions_count + 1 WHERE id = $1';

    try {
      await this.pool.query(query, [id]);
    } catch (error) {
      logger.error({ error, id }, 'Failed to increment discount redemptions');
      throw new Error('Failed to increment discount redemptions');
    }
  }

  async createReferralCredit(credit: Omit<ReferralCredit, 'id' | 'createdAt'>): Promise<ReferralCredit> {
    const query = `
      INSERT INTO referral_credits (
        user_id, referred_user_id, amount, currency, applied, applied_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      credit.userId,
      credit.referredUserId,
      credit.amount,
      credit.currency,
      credit.applied,
      credit.appliedAt || null,
      credit.expiresAt || null,
    ];

    try {
      const result = await this.pool.query(query, values);
      return this.mapReferralCredit(result.rows[0]);
    } catch (error) {
      logger.error({ error, credit }, 'Failed to create referral credit');
      throw new Error('Failed to create referral credit');
    }
  }

  async getReferralCreditsByUserId(userId: string): Promise<ReferralCredit[]> {
    const query = 'SELECT * FROM referral_credits WHERE user_id = $1 ORDER BY created_at DESC';

    try {
      const result = await this.pool.query(query, [userId]);
      return result.rows.map(row => this.mapReferralCredit(row));
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get referral credits');
      throw new Error('Failed to get referral credits');
    }
  }

  async getActiveSubscriptionsCount(): Promise<number> {
    const query = "SELECT COUNT(*) FROM subscriptions WHERE status = 'active'";

    try {
      const result = await this.pool.query(query);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error({ error }, 'Failed to get active subscriptions count');
      throw new Error('Failed to get active subscriptions count');
    }
  }

  async getSubscriptionsByStatus(status: SubscriptionStatus): Promise<Subscription[]> {
    const query = 'SELECT * FROM subscriptions WHERE status = $1';

    try {
      const result = await this.pool.query(query, [status]);
      return result.rows.map(row => this.mapSubscription(row));
    } catch (error) {
      logger.error({ error, status }, 'Failed to get subscriptions by status');
      throw new Error('Failed to get subscriptions by status');
    }
  }

  private mapSubscription(row: any): Subscription {
    return {
      id: row.id,
      userId: row.user_id,
      tierId: row.tier_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripeCustomerId: row.stripe_customer_id,
      status: row.status,
      currentPeriodStart: new Date(row.current_period_start),
      currentPeriodEnd: new Date(row.current_period_end),
      cancelAtPeriodEnd: row.cancel_at_period_end,
      canceledAt: row.canceled_at ? new Date(row.canceled_at) : undefined,
      trialStart: row.trial_start ? new Date(row.trial_start) : undefined,
      trialEnd: row.trial_end ? new Date(row.trial_end) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapPaymentMethod(row: any): PaymentMethod {
    return {
      id: row.id,
      userId: row.user_id,
      stripePaymentMethodId: row.stripe_payment_method_id,
      type: row.type,
      last4: row.last4,
      brand: row.brand,
      expiryMonth: row.expiry_month,
      expiryYear: row.expiry_year,
      isDefault: row.is_default,
      createdAt: new Date(row.created_at),
    };
  }

  private mapInvoice(row: any): Invoice {
    return {
      id: row.id,
      userId: row.user_id,
      subscriptionId: row.subscription_id,
      stripeInvoiceId: row.stripe_invoice_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status,
