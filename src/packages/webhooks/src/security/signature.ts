/**
 * Webhook Security - HMAC Signature Generation and Verification
 */

import crypto from 'crypto';

export class WebhookSignature {
  /**
   * Generate HMAC signature for webhook payload
   */
  static generate(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  /**
   * Verify webhook signature
   */
  static verify(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generate(payload, secret);

    // Use timing-safe comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate webhook secret
   */
  static generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create signature header value
   */
  static createHeader(payload: string, secret: string, timestamp: number): string {
    const signaturePayload = `${timestamp}.${payload}`;
    const signature = this.generate(signaturePayload, secret);
    return `t=${timestamp},v1=${signature}`;
  }

  /**
   * Parse signature header
   */
  static parseHeader(header: string): { timestamp: number; signature: string } | null {
    const parts = header.split(',');
    let timestamp: number | null = null;
    let signature: string | null = null;

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 't') {
        timestamp = parseInt(value, 10);
      } else if (key === 'v1') {
        signature = value;
      }
    }

    if (timestamp === null || signature === null) {
      return null;
    }

    return { timestamp, signature };
  }

  /**
   * Verify signature with timestamp
   */
  static verifyWithTimestamp(
    payload: string,
    header: string,
    secret: string,
    toleranceSeconds: number = 300
  ): boolean {
    const parsed = this.parseHeader(header);
    if (!parsed) {
      return false;
    }

    const { timestamp, signature } = parsed;

    // Check timestamp tolerance (prevent replay attacks)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false;
    }

    // Verify signature
    const signaturePayload = `${timestamp}.${payload}`;
    return this.verify(signaturePayload, signature, secret);
  }
}
