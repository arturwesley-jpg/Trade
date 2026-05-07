import Stripe from 'stripe';
import { logger } from '@trade/shared/logger';
import type {
  Subscription,
  SubscriptionTier,
  SubscriptionChange,
  PaymentMethod,
  Invoice,
} from '../types/index.js';
import { getTierById, canUpgrade, canDowngrade } from '../types/subscription-tiers.js';

export class StripeService {
  private stripe: Stripe;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Stripe API key is required');
    }
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2024-12-18.acacia',
    });
  }

  async createCustomer(userId: string, email: string, name?: string): Promise<string> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          userId,
        },
      });

      logger.info({ customerId: customer.id, userId }, 'Stripe customer created');
      return customer.id;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to create Stripe customer');
      throw new Error('Failed to create customer');
    }
  }

  async createSubscription(
    customerId: string,
    priceId: string,
    trialDays?: number,
    couponId?: string
  ): Promise<Stripe.Subscription> {
    try {
      const params: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      };

      if (trialDays && trialDays > 0) {
        params.trial_period_days = trialDays;
      }

      if (couponId) {
        params.coupon = couponId;
      }

      const subscription = await this.stripe.subscriptions.create(params);

      logger.info(
        { subscriptionId: subscription.id, customerId },
        'Stripe subscription created'
      );

      return subscription;
    } catch (error) {
      logger.error({ error, customerId, priceId }, 'Failed to create subscription');
      throw new Error('Failed to create subscription');
    }
  }

  async updateSubscription(
    subscriptionId: string,
    newPriceId: string,
    prorationBehavior: 'create_prorations' | 'none' | 'always_invoice' = 'create_prorations'
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      const updatedSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: prorationBehavior,
      });

      logger.info(
        { subscriptionId, newPriceId },
        'Stripe subscription updated'
      );

      return updatedSubscription;
    } catch (error) {
      logger.error({ error, subscriptionId }, 'Failed to update subscription');
      throw new Error('Failed to update subscription');
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<Stripe.Subscription> {
    try {
      let subscription: Stripe.Subscription;

      if (cancelAtPeriodEnd) {
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      } else {
        subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      }

      logger.info(
        { subscriptionId, cancelAtPeriodEnd },
        'Stripe subscription canceled'
      );

      return subscription;
    } catch (error) {
      logger.error({ error, subscriptionId }, 'Failed to cancel subscription');
      throw new Error('Failed to cancel subscription');
    }
  }

  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      logger.info({ subscriptionId }, 'Stripe subscription reactivated');
      return subscription;
    } catch (error) {
      logger.error({ error, subscriptionId }, 'Failed to reactivate subscription');
      throw new Error('Failed to reactivate subscription');
    }
  }

  async addPaymentMethod(
    customerId: string,
    paymentMethodId: string,
    setAsDefault: boolean = true
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      if (setAsDefault) {
        await this.stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }

      logger.info(
        { customerId, paymentMethodId, setAsDefault },
        'Payment method added'
      );

      return paymentMethod;
    } catch (error) {
      logger.error({ error, customerId, paymentMethodId }, 'Failed to add payment method');
      throw new Error('Failed to add payment method');
    }
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await this.stripe.paymentMethods.detach(paymentMethodId);
      logger.info({ paymentMethodId }, 'Payment method removed');
    } catch (error) {
      logger.error({ error, paymentMethodId }, 'Failed to remove payment method');
      throw new Error('Failed to remove payment method');
    }
  }

  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to list payment methods');
      throw new Error('Failed to list payment methods');
    }
  }

  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      return await this.stripe.invoices.retrieve(invoiceId);
    } catch (error) {
      logger.error({ error, invoiceId }, 'Failed to retrieve invoice');
      throw new Error('Failed to retrieve invoice');
    }
  }

  async listInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit,
      });

      return invoices.data;
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to list invoices');
      throw new Error('Failed to list invoices');
    }
  }

  async createCoupon(
    percentOff?: number,
    amountOff?: number,
    currency?: string,
    duration: 'once' | 'repeating' | 'forever' = 'once',
    durationInMonths?: number
  ): Promise<Stripe.Coupon> {
    try {
      const params: Stripe.CouponCreateParams = {
        duration,
      };

      if (percentOff) {
        params.percent_off = percentOff;
      } else if (amountOff && currency) {
        params.amount_off = amountOff;
        params.currency = currency;
      } else {
        throw new Error('Either percentOff or amountOff with currency must be provided');
      }

      if (duration === 'repeating' && durationInMonths) {
        params.duration_in_months = durationInMonths;
      }

      const coupon = await this.stripe.coupons.create(params);
      logger.info({ couponId: coupon.id }, 'Coupon created');

      return coupon;
    } catch (error) {
      logger.error({ error }, 'Failed to create coupon');
      throw new Error('Failed to create coupon');
    }
  }

  async createRefund(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    try {
      const params: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        params.amount = amount;
      }

      const refund = await this.stripe.refunds.create(params);
      logger.info({ refundId: refund.id, paymentIntentId }, 'Refund created');

      return refund;
    } catch (error) {
      logger.error({ error, paymentIntentId }, 'Failed to create refund');
      throw new Error('Failed to create refund');
    }
  }

  async calculateProration(
    subscriptionId: string,
    newPriceId: string
  ): Promise<number> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

      const invoice = await this.stripe.invoices.retrieveUpcoming({
        customer: subscription.customer as string,
        subscription: subscriptionId,
        subscription_items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
      });

      return invoice.amount_due;
    } catch (error) {
      logger.error({ error, subscriptionId }, 'Failed to calculate proration');
      throw new Error('Failed to calculate proration');
    }
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      logger.error({ error, subscriptionId }, 'Failed to retrieve subscription');
      throw new Error('Failed to retrieve subscription');
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        throw new Error('Customer has been deleted');
      }
      return customer as Stripe.Customer;
    } catch (error) {
      logger.error({ error, customerId }, 'Failed to retrieve customer');
      throw new Error('Failed to retrieve customer');
    }
  }

  getStripeInstance(): Stripe {
    return this.stripe;
  }
}
